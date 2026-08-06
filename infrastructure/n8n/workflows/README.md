# n8n starter workflows

The two JSON files in this directory are **starter workflows** that the
operator imports into the self-hosted n8n at https://n8n.cloudless.gr via
**Workflows → Import from File**. They're the source-of-truth for the
two app-side automations wired in PR R2:

| File | Triggered by | Does |
| ---- | ------------ | ---- |
| `lead-enrich.json` | EspoCRM `Lead.create` → `POST /api/webhooks/n8n/trigger` (name=`lead-enrich`) | Assigns owner via round-robin from a hardcoded list, PUTs the assignment back to EspoCRM, and Slack-DMs the assignee. (Apollo enrich was dropped 2026-06-21 — see the note below if you want it back.) |
| `newsletter-nurture.json` | `/api/subscribe` → `POST /api/webhooks/n8n/trigger` (name=`newsletter-nurture`) | Tags the new EspoCRM contact with `newsletter_signup_<source>`, adds them to the `Newsletter Nurture` sequence in EspoCRM. |

## Operator bootstrap (one-time per workflow)

1. Log in to https://n8n.cloudless.gr as `tbaltzakis@cloudless.gr`.
2. **Workflows → Import from File**, pick the JSON.
3. Open the imported workflow, click the **Webhook** node, copy the
   **production URL** (`https://n8n.cloudless.gr/webhook/<path>`).
4. Click the canvas → **Activate** toggle (top-right) → ON.
5. Find the workflow's **ID** in the URL (it's a UUID).

### Configuration

Configure these secrets in the n8n **Settings → Environment Variables** or via the `cloudless.db` table:

| Variable | Description |
|----------|-------------|
| `N8N_WORKFLOW_LEAD_ENRICH_ID` | Lead enrichment workflow ID |
| `N8N_WORKFLOW_NEWSLETTER_NURTURE_ID` | Newsletter nurture workflow ID |
| `NOTION_WEBHOOK_SECRET` | Secret for webhook verification |

**Note:** SSM is no longer used. Secrets are now managed through:
- D1 database (`cloudless.db` table)
- n8n environment variables
- Cloudflare Secrets (for Workers)

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

Or by hand:

```bash
# Should respond 200 with the workflow's webhook output
curl -sk -X POST \
  -H 'Content-Type: application/json' \
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
