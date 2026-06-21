# n8n starter workflows

The two JSON files in this directory are **starter workflows** that the
operator imports into the self-hosted n8n at https://n8n.cloudless.gr via
**Workflows → Import from File**. They're the source-of-truth for the
two app-side automations wired in PR R2:

| File | Triggered by | Does |
| ---- | ------------ | ---- |
| `lead-enrich.json` | EspoCRM `Lead.create` → `POST /api/webhooks/n8n/trigger` (name=`lead-enrich`) | Enriches the lead via Apollo (if `APOLLO_API_KEY` set in n8n), assigns owner via round-robin from a hardcoded list, and Slack-DMs the assignee. Falls through gracefully if Apollo isn't configured. |
| `newsletter-nurture.json` | `/api/subscribe` → `POST /api/webhooks/n8n/trigger` (name=`newsletter-nurture`) | Tags the new EspoCRM contact with `newsletter_signup_<source>`, adds them to the `Newsletter Nurture` sequence in EspoCRM. |

## Operator bootstrap (one-time per workflow)

1. Log in to https://n8n.cloudless.gr as `tbaltzakis@cloudless.gr`.
2. **Workflows → Import from File**, pick the JSON.
3. Open the imported workflow, click the **Webhook** node, copy the
   **production URL** (`https://n8n.cloudless.gr/webhook/<path>`).
4. Click the canvas → **Activate** toggle (top-right) → ON.
5. Copy the workflow's **ID** from the URL (it's a UUID in
   `https://n8n.cloudless.gr/workflow/<UUID>`).
6. Write the ID to SSM so `/api/webhooks/n8n/trigger` can find it:
   ```bash
   aws ssm put-parameter \
     --name /cloudless/production/N8N_WORKFLOW_LEAD_ENRICH_ID \
     --type String --value '<UUID>' --overwrite
   aws ssm put-parameter \
     --name /cloudless/production/N8N_WORKFLOW_NEWSLETTER_NURTURE_ID \
     --type String --value '<UUID>' --overwrite
   ```
7. (Optional) refresh the SSM cache in the Next.js Lambda:
   ```bash
   kubectl -n cloudless rollout restart deploy/cloudless
   ```

_(Apollo enrich was previously documented here but was dropped 2026-06-21 — data
coverage is thin for Greek SMBs + lead volume is too low to justify the cost.
The `lead-enrich` workflow now goes Webhook → Extract → Round-robin → EspoCRM
PUT → Slack DM. Re-add an HTTP-Request node before "Round-robin" if/when you
want enrichment back.)_

## Verify

Easiest path — use the canned probe script:

```bash
bash scripts/probe-lead-enrich.sh
```

It reads `NOTION_WEBHOOK_SECRET` from SSM, POSTs a synthetic Lead, and
prints HTTP + body. It also tails the most recent n8n execution if
`N8N_API_KEY` is set.

Or by hand:

```bash
# Should respond 200 with the workflow's webhook output
curl -sk -X POST \
  -H 'Content-Type: application/json' \
  -H "x-n8n-trigger-secret: $(aws ssm get-parameter --name /cloudless/production/NOTION_WEBHOOK_SECRET --with-decryption --query Parameter.Value --output text)" \
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
