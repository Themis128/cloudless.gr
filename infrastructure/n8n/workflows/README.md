# n8n starter workflows

The JSON files in this directory are **starter workflows** that the
operator imports into the self-hosted n8n at https://n8n.cloudless.gr via
**Workflows → Import from File**. They're the source-of-truth for the
analytics and automation workflows wired to cloudless.gr.

## Workflows Overview

| File | Trigger | Purpose | Required Env Vars |
| ---- | ------------ | ---- | ------------ |
| `lead-enrich.json` | Webhook (POST `/webhook/lead-enrich`) | Round-robin owner assignment, updates EspoCRM, Slack DM | `ESPOCRM_API_KEY`, `SLACK_BOT_TOKEN` |
| `newsletter-nurture.json` | Webhook (POST `/webhook/newsletter-nurture`) | Tags contact in EspoCRM, sends nurture email | `ESPOCRM_API_KEY`, `SITE_URL`, `NEWSLETTER_SEND_SECRET` |
| `funnel-daily-rollup.json` | Cron (daily midnight) | Fetches analytics, posts to Slack, uploads to DuckDB | `ANALYTICS_API_URL`, `ADMIN_COOKIE`, `SLACK_WEBHOOK_URL`, `DUCKDB_API_URL` |
| `rfm-cohort-update.json` | Cron (weekly Sunday 2am) | Triggers RFM compute, posts summary to Slack | `CLOUDLESS_API_URL`, `CRON_SECRET`, `SLACK_WEBHOOK_URL` |
| `hot-lead-alert.json` | Webhook (POST `/webhook/hot-lead`) | Alerts #notifications when lead score >65 | `SLACK_WEBHOOK_URL` |
| `postiz-utm-guard.json` | Webhook (POST `/webhook/postiz-published`) | Alerts #campaigns on missing UTM params | `SLACK_BOT_TOKEN` (credential) |

## Environment Variables

These are set in n8n **Settings → Environment Variables** after import:

| Variable | Used By | Default |
|----------|---------|---------|
| `SLACK_WEBHOOK_URL` | funnel-daily-rollup, rfm-cohort-update, hot-lead-alert | `https://hooks.slack.com/services/...` |
| `SLACK_BOT_TOKEN` | lead-enrich, postiz-utm-guard (as credential) | Slack Bot Token credential |
| `ESPOCRM_API_KEY` | lead-enrich, newsletter-nurture | EspoCRM API key |
| `ESPOCRM_BASE_URL` | lead-enrich, newsletter-nurture | `https://espocrm.cloudless.gr` |
| `SITE_URL` | newsletter-nurture | `https://cloudless.gr` |
| `NEWSLETTER_SEND_SECRET` | newsletter-nurture | - |
| `ANALYTICS_API_URL` | funnel-daily-rollup | `https://cloudless.gr` |
| `ADMIN_COOKIE` | funnel-daily-rollup | - |
| `DUCKDB_API_URL` | funnel-daily-rollup | `http://duckdb.cloudless.gr` |
| `CLOUDLESS_API_URL` | rfm-cohort-update | `https://cloudless.gr` |
| `CRON_SECRET` | rfm-cohort-update | - |

## Operator Bootstrap (one-time per workflow)

1. Log in to https://n8n.cloudless.gr as `tbaltzakis@cloudless.gr`.
2. **Workflows → Import from File**, pick the JSON.
3. Open the imported workflow, click the **Webhook** node, copy the
   **production URL** (`https://n8n.cloudless.gr/webhook/<path>`).
4. Click the canvas → **Activate** toggle (top-right) → ON.
5. Add credentials in n8n (for workflows that need them):
   - **HTTP Header Auth (Slack Bot Token)**: For workflows using `SLACK_BOT_TOKEN`
   - **EspoCRM API Key**: For workflows updating CRM
6. Set workflow environment variables (above table).
7. For the two core workflows, write the workflow ID to SSM:

   ```bash
   aws ssm put-parameter \
     --name /cloudless/production/N8N_WORKFLOW_LEAD_ENRICH_ID \
     --type String --value '<UUID>' --overwrite
   aws ssm put-parameter \
     --name /cloudless/production/N8N_WORKFLOW_NEWSLETTER_NURTURE_ID \
     --type String --value '<UUID>' --overwrite
   ```

8. (Optional) refresh the SSM cache in the Next.js Lambda:

   ```bash
   kubectl -n cloudless rollout restart deploy/cloudless
   ```

## Verification

Easiest path — use the canned probe script:

```bash
bash scripts/probe-lead-enrich.sh
```

It reads `N8N_TRIGGER_SECRET` from SSM, POSTs a synthetic Lead, and
prints HTTP + body. It also tails the most recent n8n execution if
`N8N_API_KEY` is set.

Or by hand:

```bash
# Should respond 200 with the workflow's webhook output
curl -sk -X POST \
  -H 'Content-Type: application/json' \
  -H "x-n8n-trigger-secret: $(aws ssm get-parameter --name /cloudless/production/N8N_TRIGGER_SECRET --with-decryption --query Parameter.Value --output text)" \
  -d '{"name":"lead-enrich","payload":{"entity":"Lead","action":"create","record":{"firstName":"Test","lastName":"Lead","emailAddress":"test@example.com"}}}' \
  https://cloudless.gr/api/webhooks/n8n/trigger
```

## Why workflows-as-JSON

Importing JSON keeps the workflows reviewable in git (you can diff
versions before importing an update) AND lets the operator tune them in
the n8n UI without committing every iteration back. The JSON in this
directory is the **starter** — the operator's live version may have
provider credentials filled in or extra Set / IF nodes. Re-export and
PR the JSON when a structural change is worth versioning.

## Validation Tests

The workflow JSON files are validated by Playwright tests in `e2e/workflows.spec.ts`.
Run them with:

```bash
pnpm test:e2e --grep "n8n workflow"
```

These tests check for:
- Valid JSON structure
- All referenced nodes exist
- All connections reference existing nodes
- All nodes have required fields
- At least one trigger node present
- Unique webhook paths