---
name: espocrm-operator
description: |
  Deploy, debug, and operate the self-hosted EspoCRM stack (HubSpot
  replacement). Triggered by phrases like "EspoCRM is down", "create an
  EspoCRM Lead", "EspoCRM API error", "rotate the EspoCRM API key", "the
  espocrm-to-lake ETL failed", "EspoCRM webhook not firing", "import
  contacts into EspoCRM", "EspoCRM Slack sync", "check espocrm.cloudless.gr",
  "EspoCRM Inbound Email", or any operational task on the `espocrm` k8s
  namespace, `src/lib/espocrm.ts`, or the EspoCRM SES bridge Lambda.
---

# EspoCRM operator toolkit

EspoCRM (SugarCRM lineage, self-hosted) replaced HubSpot on 2026-06-20 when
HubSpot's `content` scope got paywalled behind Marketing Hub Pro. HubSpot
is fully decommissioned (PR #1043, ~3,387 LOC removed). Live at
`https://espocrm.cloudless.gr`.

The drop-in mirror of the old HubSpot client surface is at
`src/lib/espocrm.ts` — 21 exports matching `src/lib/hubspot.ts` 1:1
(`upsertContact`, `createTicket`, `listDeals`, `createDeal`,
`getDealsByStage`, `getPipelineStats`, …). Module mapping:
Contact↔contact, Account↔company, Opportunity↔deal, Case↔ticket.

## Topology cheat sheet

| Pod | Node | Notes |
| --- | --- | --- |
| espocrm (PHP+nginx) | omv | `espocrm/espocrm:9` image |
| mariadb | omv | `mariadb:11`; PVC `local-path` (sda1) |

Both pinned to omv via `nodeSelector`. NodePort 30700 → Cloudflare tunnel
fragment `infrastructure/espocrm/cloudflare-tunnel.yaml`. Source of truth:
`infrastructure/espocrm/k8s/espocrm.yaml`. Operator runbook:
`infrastructure/espocrm/README.md`.

## Auth + secrets

| Secret | Where | Purpose |
| --- | --- | --- |
| `/cloudless/production/ESPOCRM_BASE_URL` | SSM | `https://espocrm.cloudless.gr` |
| `/cloudless/production/ESPOCRM_API_KEY` | SSM | API user `cloudless-app` (role `Cloudless App Full Access`, ID `6a36ef141808ed737`) |
| `/cloudless/production/ESPOCRM_WEBHOOK_SECRET` | SSM | HMAC for `/api/webhooks/espocrm` |
| EspoCRM admin login | UI only | Stored in operator's password manager |

All API calls authenticate with header `X-Api-Key: <key>`. The Next.js
helper at `src/lib/espocrm.ts` handles this transparently — never
construct your own auth headers in route code.

## Tool selection — pick the most specific that fits

1. **Just want to check it's up?**

   ```bash
   curl -sI https://espocrm.cloudless.gr/                # expect 200
   curl -sI -H "X-Api-Key: $ESPOCRM_API_KEY" \
     https://espocrm.cloudless.gr/api/v1/App/user        # expect 200
   ```

2. **Pod state?** `kubectl_get` with `namespace=espocrm`. Both pods should
   be Running; if mariadb is CrashLoop, check PVC quota on sda1 first
   (`df -h /srv/dev-disk-by-uuid-a9a5a108-…`).

3. **Need to CRUD via the API in code?** Use the existing helpers in
   `src/lib/espocrm.ts`. Do NOT write raw `fetch()` calls against the
   EspoCRM REST API in admin routes — every helper already handles
   pagination, auth, error mapping, and the
   `IntegrationNotConfiguredError` fallback for local dev without SSM.

4. **Need to add a new Espo entity sync to Slack?** Register a Webhook
   entity in EspoCRM UI (Administration → Webhooks) pointing at
   `https://cloudless.gr/api/webhooks/espocrm`. The receiver at
   `src/app/api/webhooks/espocrm/route.ts` already dispatches to
   `SlackClient` per `feedback_slack_use_slackclient`.

## API key creation runbook

When a new external service needs API access (e.g. another ETL):

1. EspoCRM UI → Administration → Roles → New: "Cloudless XYZ Full".
   Grant only the entities the consumer needs (least privilege).
2. Administration → User Management → New API User. Assign the role. Click
   "Generate API Key" — **the key shows once**; copy immediately.
3. Store in SSM: `aws ssm put-parameter --name
   /cloudless/production/ESPOCRM_API_KEY_<service> --value <key> --type
   SecureString --overwrite`.
4. Reference in your code via `getIntegrationsAsync()` (see how
   `ESPOCRM_API_KEY` is wired in `src/lib/ssm-config.ts`).

## Drop-in mirror surface (HubSpot → EspoCRM)

If you find yourself missing a function that existed in the old
`hubspot.ts`, **don't write a new helper** — check `src/lib/espocrm.ts`
first. The full list of 21 mirrored exports is at the top of that file.
The two areas that intentionally diverge:

- **Deal stages**: HubSpot used named pipeline stages
  (`appointmentscheduled`, `qualifiedtobuy`, `closedwon`). EspoCRM uses
  internal stage IDs (`Stage1`, `Stage2`, …). The mapping table lives at
  the top of `src/lib/espocrm.ts` — extend it if you add a new stage in
  the EspoCRM UI.
- **`getOwners()`** doesn't exist — EspoCRM has no "owner" concept
  matching HubSpot's. Use `getUsers()` for the closest analog.

## ETL: EspoCRM → S3 data lake

`scripts/etl/espocrm-to-lake.mjs` runs daily via GitHub Actions
(`.github/workflows/etl-espocrm-to-lake.yml`). Writes Parquet to
`s3://cloudless-data-lake/espocrm/{entity}/year=YYYY/month=MM/day=DD/`.
Athena views in `cloudless_analytics.espocrm_*` join Contact, Lead,
Opportunity, Case for analytics-dashboard queries.

Failure modes:

- **404 on entities**: Verify the entity is enabled in EspoCRM UI
  (Administration → Entity Manager). Stripe + EspoCRM upgrades sometimes
  silently disable Workflow/BPM entities.
- **Stuck pagination**: EspoCRM caps `maxSize=200`; the ETL's
  `fetchAllPaginated()` handles offset chunks. If a single entity's
  fetch exceeds 60s, increase the workflow's `timeout-minutes`.

## SES → EspoCRM Case bridge

Inbound email at `tbaltzakis@cloudless.gr` flows via SES → S3 → Lambda
(`infrastructure/aws/lambdas/ses-espocrm-bridge/`) → EspoCRM Case create.
The Lambda hydrates `ESPOCRM_API_KEY` from SSM at cold-start (see
`feedback_slack_lambda_env_frozen` — same pattern; env is frozen). If
inbound mail stops becoming Cases, check:

1. CloudWatch Logs for the `ses-espocrm-bridge` Lambda.
2. The Lambda's IAM role has `ssm:GetParameter` on
   `/cloudless/production/ESPOCRM_*`.
3. SES inbound rule still routes to the S3 bucket.

## Slack sync

Six Webhook entities registered in EspoCRM (one per event) all POST to
`/api/webhooks/espocrm` with HMAC signature:

- Contact create
- Lead create
- Opportunity create
- Opportunity stage-change
- Case create
- Case status-change

Per `feedback_slack_use_slackclient`, the receiver dispatches via
`SlackClient` (not raw `chat.postMessage`) so retry/backoff/webhook-fallback
are preserved.

## Common ops

### Bump the EspoCRM image

```bash
# Update tag in infrastructure/espocrm/k8s/espocrm.yaml then:
kubectl apply -f infrastructure/espocrm/k8s/espocrm.yaml
kubectl -n espocrm rollout status deploy/espocrm
```

EspoCRM runs its own DB migrations on boot (`composer install` + schema
sync via `php command.php rebuild`). If it gets stuck, exec into the pod
and run `php command.php rebuild` manually.

### Install/upgrade an EspoCRM extension

```bash
# Copy .zip into the pod
kubectl -n espocrm cp /tmp/ext.zip espocrm-XXX:/var/www/html/data/upload/extensions/
# Install via CLI
kubectl -n espocrm exec espocrm-XXX -- php command.php extension --file=/var/www/html/data/upload/extensions/ext.zip
```

The `Export Import` extension v2.9.0 is the canonical example, installed
2026-06-20.

### Rotate the API key

1. EspoCRM UI → User cloudless-app → Generate New API Key.
2. `aws ssm put-parameter --name /cloudless/production/ESPOCRM_API_KEY
   --value <new-key> --type SecureString --overwrite`.
3. Restart Lambda + Next.js app for them to re-read at next cold-start
   (the SSM cache TTL is 5 min in `getIntegrationsAsync()` anyway).
4. Delete the old API key in the EspoCRM UI.

## See also

- `infrastructure/espocrm/README.md` — full deploy + verify runbook
- `infrastructure/espocrm/k8s/espocrm.yaml` — source of truth
- `infrastructure/espocrm/cloudflare-tunnel.yaml` — tunnel fragment
- `src/lib/espocrm.ts` — drop-in HubSpot mirror
- `src/app/api/webhooks/espocrm/route.ts` — Slack sync receiver
- `scripts/etl/espocrm-to-lake.mjs` — daily Athena hydrator
- `infrastructure/aws/lambdas/ses-espocrm-bridge/` — Inbound Email bridge
- `skills/cloudflare-tunnel-ops/SKILL.md` — exposure tooling
- `skills/appflowy-operator/SKILL.md` — sibling CMS stack
- Memory: `feedback_slack_use_slackclient`, `feedback_slack_lambda_env_frozen`
