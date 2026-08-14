# n8n starter workflows

The two JSON files in this directory are **starter workflows** that the
operator imports into the self-hosted n8n at https://n8n.cloudless.gr via
**Workflows → Import from File**. They're the source-of-truth for the
two app-side automations wired in PR R2:

| File | Triggered by | Does |
| ---- | ------------ | ---- |
| `lead-enrich.json` | EspoCRM `Lead.create` → `POST /api/webhooks/n8n/trigger` (name=`lead-enrich`) | Assigns owner via round-robin from a hardcoded list, PUTs the assignment back to EspoCRM, and Slack-DMs the assignee. (Apollo enrich was dropped 2026-06-21 — see the note below if you want it back.) |
| `newsletter-nurture.json` | `/api/subscribe` → `POST /api/webhooks/n8n/trigger` (name=`newsletter-nurture`) | Tags the new EspoCRM contact with `newsletter_signup_<source>`, adds them to the `Newsletter Nurture` sequence in EspoCRM. |
| `postiz-rss-multichannel.json` | Schedule (every 6h) | Reads RSS → builds a caption → lists Postiz channels in-cluster → `POST /api/public/v1/posts` to matching platforms. No Next.js involvement. |
| `postiz-utm-guard.json` | Postiz webhook (or manual) | Ensures outbound social URLs carry UTM params before / alongside Postiz publish. Pair with app webhook `https://cloudless.gr/api/webhooks/postiz?secret=…`. |

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

## Postiz RSS → multi-channel (operator setup)

1. Import `postiz-rss-multichannel.json` into https://n8n.cloudless.gr.
2. Create credential **Header Auth**:
   - Name: `Authorization`
   - Value: your Postiz Public API key (Settings → Developers → Public API).
3. Point both HTTP Request nodes at that credential (replace the placeholder credential id).
4. Optional env vars on the n8n Deployment (or workflow Variables):
   - `POSTIZ_API_BASE` — default `http://postiz.postiz.svc.cluster.local:5000` (in-cluster, no Cloudflare Access).
   - `POSTIZ_RSS_FEED_URL` — default `https://cloudless.gr/en/blog/rss.xml`.
   - `POSTIZ_CHANNEL_IDENTIFIERS` — comma list, default `linkedin,linkedin-page,x,bluesky`.
5. Connect at least one matching channel in the Postiz UI, then Activate the workflow.

### Postiz UTM guard

1. Import `postiz-utm-guard.json` the same way.
2. Wire its webhook URL into Postiz Settings → Webhooks **or** use the app
   receiver (`scripts/postiz-register-webhook.sh` →
   `https://cloudless.gr/api/webhooks/postiz?secret=<POSTIZ_WEBHOOK_SECRET>`).
3. Activate once channels exist.

Optional: install the community node `n8n-nodes-postiz` (Settings → Community Nodes) and
swap the HTTP Request nodes for the dedicated Postiz node. Host must end with `/api`
(e.g. `http://postiz.postiz.svc.cluster.local:5000/api`).

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
