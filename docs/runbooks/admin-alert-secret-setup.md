# `ADMIN_ALERT_SECRET` — one-time operator setup

`/api/webhooks/admin-alert` is a shared-secret POST endpoint that any
cron / probe / external sender can use to fire `notifyAdmin()`
(Slack + ntfy fan-out). The shared secret has **two copies that must
match exactly**:

| Side | Where | Read by |
|---|---|---|
| Pi Next.js app (the receiver) | SSM `/cloudless/production/ADMIN_ALERT_SECRET` (us-east-1) | `src/lib/ssm-config.ts` reads at request time via `pi-standby-aws-creds`; route reads `cfg.ADMIN_ALERT_SECRET` (with fallback to `cfg.NOTION_WEBHOOK_SECRET`) |
| Senders (probes, CronJobs) | Whatever they need (env var, k8s Secret, etc.) | The pod / process posting the alert |

The route handler:

- expects header `x-cloudless-alert-secret: <token>`
  (**not** `Authorization: Bearer …` — easy to get wrong)
- uses `crypto.timingSafeEqual` so wrong-secret requests are 401, not silently dropped
- returns `503 receiver_not_configured` if both SSM keys are empty

Source of truth: `src/app/api/webhooks/admin-alert/route.ts`.

## Operator setup — once

Confirmed missing as of 2026-06-22. Closing the gap takes ~2 minutes.

```bash
# 1. Generate a fresh shared secret
TOKEN=$(openssl rand -hex 32)
echo "TOKEN=$TOKEN  # save this somewhere — you'll re-use it for k8s Secret below"

# 2. Write to SSM (us-east-1 — confirmed by pi-standby creds region)
aws ssm put-parameter \
  --name /cloudless/production/ADMIN_ALERT_SECRET \
  --type SecureString \
  --value "$TOKEN" \
  --overwrite \
  --region us-east-1

# 3. The Pi app reads SSM at request time (no module-level caching for
#    ADMIN_ALERT_SECRET), so the new value is picked up immediately —
#    no pod restart or redeploy needed.

# 4. Mirror into k8s Secrets that need to call the endpoint.
#    Currently only one consumer: the sdb1 capacity probe.
kubectl -n omv-ops create secret generic admin-alert-secret \
  --from-literal=ADMIN_ALERT_SECRET="$TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

# 5. Verify end-to-end — force a one-off probe job
kubectl -n omv-ops create job sdb1-verify-alert --from=cronjob/sdb1-readme-and-probe
# After ~30 s, check that the alert hit Slack/ntfy.
# (Or look at the job's exit log: `kubectl -n omv-ops logs -l job-name=sdb1-verify-alert`)
```

## Senders to update when the secret rotates

Anything that POSTs to `/api/webhooks/admin-alert` needs the new token.
As of 2026-06-22 the inventory is:

| Sender | Where the token lives | Rotate command |
|---|---|---|
| `omv-ops/sdb1-readme-and-probe` CronJob | k8s Secret `omv-ops/admin-alert-secret` key `ADMIN_ALERT_SECRET` | Step 4 above |
| (future) `probe-pi-ssm-scope.yml` workflow | GH repo secret `ADMIN_ALERT_TOKEN` — IF wired (R18 uses Bearer scheme, not this header; remove or re-name if you ever consolidate) | `gh secret set ADMIN_ALERT_TOKEN` |
| (future) Sentry Internal Integration | Sentry → Developer Settings → New Internal Integration → custom header `x-cloudless-alert-secret: $TOKEN` | Sentry UI |

Rotation = repeat Steps 1, 2, 3, then update every row above in the
same window. Don't drift; if the SSM value rotates and a sender still
has the old token, every alert from that sender will silently 401.

## Why this isn't an R-row

It's listed in `docs/master-todo-list.md` Phase 0 alongside the Sentry
webhook setup — both are operator-side one-time clicks that no PR can
ship. Not "R-row work" because there's no code to write; just
provision.

## Related code

- Route handler: `src/app/api/webhooks/admin-alert/route.ts`
- SSM lookup: `src/lib/ssm-config.ts` (`getConfig()` → `ADMIN_ALERT_SECRET`)
- Slack/ntfy fan-out helper: `src/lib/admin-alerts.ts` (`notifyAdmin()`)
- First consumer of the wire: `infrastructure/omv-sdb1/cronjob-share-readme-and-probe.yaml`

## R18 note — different secret, different header

The R18 probe (`scripts/audit-pi-ssm-scope.sh` + `probe-pi-ssm-scope.yml`)
also POSTs to `/api/webhooks/admin-alert` but uses
`Authorization: Bearer <token>` against a GH-secret-stored
`ADMIN_ALERT_TOKEN`. That's actually **wrong** — the route ignores
the `Authorization` header. R18's alerts have never landed because of
this. Two options:

1. Add `Authorization: Bearer` support to the route handler
2. Patch `probe-pi-ssm-scope.yml` to use `x-cloudless-alert-secret`
   and rename the GH secret to `ADMIN_ALERT_SECRET`

Option 2 is cleaner — keeps one auth pattern across all senders. Open
as a follow-up PR; not blocking the sdb1 probe.
