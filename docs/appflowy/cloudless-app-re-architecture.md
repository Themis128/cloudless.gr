# cloudless.gr — re-architecture (2026-06-21)

> **For AppFlowy operators**: this file is shaped to be imported directly into AppFlowy as a Document.
> In AppFlowy desktop: **+ New page** → choose **Document** → drag-drop this `.md` file onto the page,
> or use **··· → Import → From Markdown**. Headings, code blocks, tables, and checkboxes round-trip
> cleanly. Internal links of the form `docs/foo.md` won't work after import — they're left as
> code-fenced paths so the operator knows where to look in the git repo.
>
> AppFlowy-Cloud has no public REST API for page creation
> ([AppFlowy-Cloud#1013](https://github.com/AppFlowy-IO/AppFlowy-Cloud/issues/1013)) — this is the
> recommended path until it does. See `docs/appflowy-phase3-plan.md` for the prior investigation.

---

## What changed today

Three small features wire the newly self-hosted apps (Postiz, n8n, Mosquitto) into the
cloudless.gr Next.js app and the AWS Lambda half. All shipped in PR #1073 against `main` on
2026-06-21 — squash-merged and the feature branch is gone.

| R-row | Slug | One-liner | Owner |
| :---- | :--- | :-------- | :---- |
| **R1** | auto-post-on-blog-publish | Blog Status → Published fires Postiz to LinkedIn/X/Meta/TikTok | `src/lib/postiz-blog.ts` |
| **R2** | n8n-trigger-receiver | Internal POST endpoint that delegates work to n8n workflows by alias | `src/app/api/webhooks/n8n/trigger` |
| **R3** | mqtt-cluster-chip | Live alert pill on `/admin/cluster` reads retained MQTT status | `src/lib/mqtt.ts` |

---

## R1 — auto-post-on-blog-publish

### Behaviour

When a blog row in Notion (or whichever editor the blog DB currently lives in) flips its
**Status** field to **Published**, the Notion webhook receiver fires
`scheduleBlogShare(...)` from `src/lib/postiz-blog.ts`. That helper:

1. Bails out unless `AUTO_POST_BLOG_TO_SOCIAL=1` is set (default OFF — operator vets copy).
2. Confirms Postiz is reachable.
3. Checks the last 60 days of Postiz posts for a body containing the idempotency tag
   `blog-<pageId>`. Skips if one exists.
4. Resolves connected channels for LinkedIn, X, Meta and TikTok via
   `listPostizIntegrations() + matchIntegrationsForPlatform()`.
5. Calls `schedulePost({ content, integrationIds })` — posts immediately. The tag is
   embedded in the body so future runs can skip duplicates.

### Files

```text
src/lib/postiz-blog.ts                       (new — 91 LOC)
src/app/api/webhooks/notion/route.ts         (modified — handlePageUpdated fires fan-out)
```

### Operator one-time setup

To enable: set `AUTO_POST_BLOG_TO_SOCIAL=1` in the Lambda env via SST stack config OR via
the deploy workflow build args. Until then this is a logged no-op. Cluster pods read it
from their Deployment env block.

### Verify

Set `AUTO_POST_BLOG_TO_SOCIAL=1` and publish a test blog row; the next Notion webhook fires
the fan-out, server logs `[notion webhook → postiz] posted N channel(s)`, and the new
posts appear in Postiz under `https://postiz.cloudless.gr/launches`.

---

## R2 — n8n trigger receiver + EspoCRM hook + 2 starter workflows

### Behaviour

A new internal POST endpoint `/api/webhooks/n8n/trigger` accepts either a raw n8n workflow
UUID or one of two well-known aliases (`lead-enrich`, `newsletter-nurture`) and forwards
the payload to the matching workflow on `https://n8n.cloudless.gr`. The EspoCRM webhook
receiver now also calls this endpoint on every `Lead.create` event, in parallel with the
existing Slack notify, via `Promise.allSettled` so a Slack failure can't drop the n8n
trigger and vice-versa.

The two starter workflows ship as committed JSON files. The operator imports them once
into n8n, copies the resulting workflow UUIDs, and writes them to SSM
(`N8N_WORKFLOW_LEAD_ENRICH_ID`, `N8N_WORKFLOW_NEWSLETTER_NURTURE_ID`). Until those SSM
keys are set, the trigger receiver returns `204 No Content` and the caller silently
no-ops — so production traffic isn't gated on the operator's setup pace.

### Files

```text
src/lib/n8n.ts                                       (+ triggerWorkflowByWebhookPath)
src/app/api/webhooks/n8n/trigger/route.ts            (new)
src/app/api/webhooks/espocrm/route.ts                (Lead.create now triggers n8n)
infrastructure/n8n/workflows/lead-enrich.json        (new — starter)
infrastructure/n8n/workflows/newsletter-nurture.json (new — starter)
infrastructure/n8n/workflows/README.md               (new — operator runbook)
```

### Starter workflow shapes

**lead-enrich.json** — Webhook → Set (extract email/name/leadId) → HTTP Apollo enrich
(optional, continueOnFail) → Function round-robin assignment → HTTP `PUT EspoCRM Lead`
(set `assignedUserName`) → HTTP `slack chat.postMessage` to `#leads`.

**newsletter-nurture.json** — Webhook → Set (extract email/source) → HTTP `POST EspoCRM
Contact massUpdate` (tag with `newsletter_signup_<source>`) → Wait 2 days → HTTP `POST
cloudless.gr/api/newsletter/send` (day-2 nurture email).

### Operator one-time setup

1. Log in to `https://n8n.cloudless.gr` as `tbaltzakis@cloudless.gr`.
2. **Workflows → Import from File** for each of the two JSONs.
3. Activate each workflow (toggle top-right).
4. Copy each workflow's UUID from the URL and write to SSM:

   ```bash
   aws ssm put-parameter --name /cloudless/production/N8N_WORKFLOW_LEAD_ENRICH_ID --type String --value '<UUID>' --overwrite
   aws ssm put-parameter --name /cloudless/production/N8N_WORKFLOW_NEWSLETTER_NURTURE_ID --type String --value '<UUID>' --overwrite
   ```

5. (Optional) restart the cloudless Lambda / k3s deployment to refresh the SSM cache.

### Verify

```bash
# Should respond 200 with the workflow's webhook output
curl -sk -X POST \
  -H 'Content-Type: application/json' \
  -H "x-n8n-trigger-secret: <NOTION_WEBHOOK_SECRET>" \
  -d '{"name":"lead-enrich","payload":{"entity":"Lead","action":"create","record":{"firstName":"Test","lastName":"Lead","emailAddress":"test@example.com"}}}' \
  https://cloudless.gr/api/webhooks/n8n/trigger
```

---

## R3 — MQTT cluster chip

### Behaviour

The Pi-side `alert-api` Lambda publishes a JSON payload to the retained MQTT topic
`homelab/alerts/status` every time an alert fires or resolves. The new chip on
`/admin/cluster` reads that latest retained payload and renders a coloured pill:

- 🟢 **OK (n)** — severity `ok` or `info`
- 🟡 **WARN (n)** — severity `warning`
- 🔴 **ERROR/HIGH/CRITICAL (n)** — anything red-tier
- ⚪ **—** — broker unreachable, no retained message yet, or MQTT creds missing

### Files

```text
src/lib/mqtt.ts                                   (new — readLatestAlertStatus + publishAlertStatus)
src/app/api/admin/cluster/mqtt-status/route.ts    (new — admin-gated GET)
src/app/[locale]/admin/cluster/page.tsx           (chip added next to the page title)
src/lib/ssm-config.ts                             (4 MQTT_* keys wired)
```

### Architecture notes

- `mqtt` npm dep is **lazy-imported** so routes that never call it stay slim.
- Per `feedback_slack_lambda_env_frozen`: SSM config lookup is cached on the module via a
  `mqttConfigPromise` — one round-trip per warm Lambda invocation, not per request.
- The reader does a single-shot `connect → subscribe → first-message → end()`. No
  long-lived connections from Lambda or k8s pods (would leak across requests).
- Per Phase-3 cutover (`skills/mqtt-auth-rollout/SKILL.md`), the broker requires both
  username and password — anonymous reads were turned off on 2026-06-21.

### Operator one-time setup

Already done as part of mosquitto Phase 3 admin auth rollout:

```bash
aws ssm get-parameter --name /cloudless/production/MQTT_USERNAME    --query Parameter.Value --output text  # tbaltzakis
aws ssm get-parameter --name /cloudless/production/MQTT_PASSWORD    --with-decryption --query Parameter.Value --output text
aws ssm get-parameter --name /cloudless/production/MQTT_BROKER_HOST --query Parameter.Value --output text  # mosquitto.monitoring.svc.cluster.local
aws ssm get-parameter --name /cloudless/production/MQTT_BROKER_PORT --query Parameter.Value --output text  # 1883
```

If any of those return `ParameterNotFound`, run the mosquitto rollout playbook in
`skills/mqtt-auth-rollout/SKILL.md` Stage 3 to provision them.

### Verify

```bash
# Manual seed of an OK status so the chip lights up green:
mosquitto_pub -h omv.local -p 31883 \
  -u tbaltzakis -P "$MQTT_PASSWORD" \
  -t homelab/alerts/status -r -q 1 \
  -m '{"severity":"ok","count":0,"ts":'$(date +%s)',"src":"manual-seed"}'

# Then load https://cloudless.gr/en/admin/cluster — chip should read "OK (0)".
```

---

## Where to look next

- Full plan doc: `docs/re-architecture-2026-06-21.md` (PR #1072).
- Pre-existing libs the new code builds on: `src/lib/postiz.ts`, `src/lib/n8n.ts`,
  `src/lib/espocrm.ts`, `src/lib/notion-cache.ts`.
- Operator runbooks: `skills/appflowy-operator/SKILL.md`,
  `skills/espocrm-operator/SKILL.md`, `skills/cloudflare-tunnel-ops/SKILL.md`,
  `skills/mqtt-auth-rollout/SKILL.md`.
- Memory entries you'll want loaded into a fresh session: `project_optional_secret_env_gotcha`,
  `feedback_slack_lambda_env_frozen`, `project_appflowy_phase3_blocked`.

## How to update this doc in AppFlowy

This page is the AppFlowy-side mirror of `docs/appflowy/cloudless-app-re-architecture.md`
in the repo. If the source markdown changes, the cleanest re-sync is:

1. Open this page in AppFlowy → **··· → Delete to trash**.
2. **+ New page → Document**.
3. Drag-drop the updated `.md` file from the repo onto the empty document.

(AppFlowy-Cloud doesn't expose a public REST API for page updates, so we don't have an
ETL that can keep the two in sync automatically — see `project_appflowy_phase3_blocked`.)
