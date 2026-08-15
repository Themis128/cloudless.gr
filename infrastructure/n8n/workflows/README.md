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
| `postiz-blog-ai-caption.json` | Webhook (`POST /webhook/postiz-blog-share`) | Receives blog publish event → fetches page → extracts text → lists Postiz channels → creates a draft post with UTM-tagged link. Wire from AppFlowy publish hook or manually. |
| `postiz-content-recycler.json` | Schedule (every 3 days) | Fetches published posts → scores by engagement → randomly picks from top 5 → reschedules 6h out. Evergreen content recycling. |
| `postiz-analytics-digest.json` | Schedule (Monday 09:00) | Weekly digest of Postiz analytics → Slack webhook. Shows post count, impressions, likes, comments, and top 3 performers. Requires `SLACK_WEBHOOK_URL` env var. |
| `postiz-video-distribute.json` | Webhook (`POST /webhook/postiz-video-distribute`) | Downloads video from URL → uploads to Postiz → fans out to all video-capable channels (X, LinkedIn, FB, IG, TikTok, YT, Threads, Bluesky). |
| `postiz-ai-multicaption.json` | Webhook (`POST /webhook/postiz-ai-multicaption`) | Blog publish → fetches page → AI generates per-platform captions (X: 280char punchy, LinkedIn: professional 2-3 para, IG: emoji + hashtags, etc.) → creates draft posts per channel. Default: NVIDIA NIM free endpoint (`nvidia/nemotron-3.5-lightning-30b-a3b`). Requires `NVIDIA_API_KEY` env var. |

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

### Blog AI caption (webhook-triggered)

1. Import `postiz-blog-ai-caption.json`.
2. Copy the production webhook URL (`/webhook/postiz-blog-share`).
3. Wire it as the target in the AppFlowy publish hook or call manually:
   ```bash
   curl -X POST http://n8n.n8n.svc.cluster.local:5678/webhook/postiz-blog-share \
     -H 'Content-Type: application/json' \
     -d '{"title":"My Post","url":"https://cloudless.gr/en/blog/my-post"}'
   ```
4. Posts are created as **drafts** — review in Postiz UI before publishing.

### Content recycler

1. Import `postiz-content-recycler.json`. Activate.
2. Runs every 3 days. Picks a random top-5 performer and reschedules it 6h out.
3. Requires at least one published post with analytics data to function.

### Weekly analytics digest

1. Import `postiz-analytics-digest.json`.
2. Set `SLACK_WEBHOOK_URL` env var in the n8n deployment (or as a workflow variable).
3. Fires every Monday at 09:00 — posts a summary of the past 7 days to Slack.

### Video distribution (webhook-triggered)

1. Import `postiz-video-distribute.json`.
2. Trigger via webhook with a video URL:
   ```bash
   curl -X POST http://n8n.n8n.svc.cluster.local:5678/webhook/postiz-video-distribute \
     -H 'Content-Type: application/json' \
     -d '{"videoUrl":"https://example.com/video.mp4","title":"Demo","caption":"Check this out","hashtags":"#cloud #tech","scheduleAt":"2026-08-16T10:00:00Z"}'
   ```
3. Downloads the video, uploads to Postiz storage, then schedules across all video-capable channels (X, LinkedIn, FB, IG, TikTok, YT, Threads, Bluesky).

### AI per-platform captions (webhook-triggered)

1. Import `postiz-ai-multicaption.json`.
2. Set `NVIDIA_API_KEY` env var on the n8n deployment (free key from [build.nvidia.com](https://build.nvidia.com)).
3. Optionally set `AI_MODEL` (default: `nvidia/nemotron-3.5-lightning-30b-a3b`) and `AI_API_URL` (default: `https://integrate.api.nvidia.com/v1/chat/completions`). Any OpenAI-compatible endpoint works.
4. Trigger via webhook:
   ```bash
   curl -X POST http://n8n.n8n.svc.cluster.local:5678/webhook/postiz-ai-multicaption \
     -H 'Content-Type: application/json' \
     -d '{"title":"Cloud Hosting Guide","url":"https://cloudless.gr/en/blog/cloud-hosting","locale":"en"}'
   ```
5. The AI generates a different caption for each platform (X: 280-char punchy, LinkedIn: professional 2-3 paragraphs, IG: emoji-heavy, Bluesky: conversational, etc.). Posts are created as **drafts** for review. Supports Greek (`locale: "el"`) and English.

## Bulk CLI import (from omv)

To import all Postiz workflows at once via the n8n CLI:

```bash
N8N_POD=$(kubectl get pods -n n8n -l app=n8n -o jsonpath='{.items[0].metadata.name}')
for f in postiz-rss-multichannel postiz-blog-ai-caption postiz-content-recycler postiz-analytics-digest postiz-video-distribute postiz-ai-multicaption; do
  # Add a UUID id field (required by n8n import) and strip tags
  python3 -c "
import json, uuid, sys
wf = json.load(sys.stdin)
wf['id'] = str(uuid.uuid4())
wf.pop('tags', None)
json.dump(wf, sys.stdout)
" < "infrastructure/n8n/workflows/${f}.json" > "/tmp/${f}-import.json"
  kubectl cp "/tmp/${f}-import.json" "n8n/${N8N_POD}:/tmp/${f}.json"
  kubectl exec -n n8n "$N8N_POD" -- n8n import:workflow --input="/tmp/${f}.json"
  echo "Imported ${f}"
done
```

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

## Postiz Plugs (UI-only, no API)

Plugs are Postiz's built-in auto-repost / auto-comment automation engine.
They are configured entirely through the Postiz UI — **no Public API**.

### Global Plugs (account-wide)

1. Open `postiz.cloudless.gr` → Settings → Plugs → **Global Plugs**.
2. Create rules like:
   - "When a post hits 10 likes, repost it from LinkedIn Page"
   - "Auto-comment a follow-up CTA 2 hours after publish"
   - "Repost from X account to Bluesky account after 4 hours"

### Post Plugs (per-post)

1. When composing/scheduling a post, click the **Plugs** tab.
2. Add per-post automation:
   - "Repost from other connected account in 6 hours"
   - "Add follow-up comment with link after 1 hour"

### Recommended setup for cloudless.gr

| Plug | Type | Config |
|------|------|--------|
| LinkedIn → X repost | Global | When LinkedIn post > 5 likes, repost to X after 2h |
| X → Bluesky cross-post | Global | Auto-repost X posts to Bluesky after 1h |
| CTA follow-up | Global | Auto-comment with services link 3h after publish |
| Blog amplify | Post | Repost blog shares from personal → page account after 4h |

### agent-media (AI UGC video generation)

[gitroomhq/agent-media](https://github.com/gitroomhq/agent-media) is an
MCP server from the Postiz team that generates AI UGC videos from text
descriptions or photos + scripts. It produces captioned, lip-synced vertical
video ready for TikTok/Instagram/X Reels.

To evaluate, add to `mcp.json`:
```json
"agent-media": {
  "command": "npx",
  "args": ["-y", "agent-media"],
  "env": { "POSTIZ_API_KEY": "..." }
}
```

Pipeline: blog publish → agent-media generates 30s vertical video →
Postiz schedules it to TikTok + IG Reels + X. Requires GPU-backed API
credits; evaluate cost before enabling.

## Why workflows-as-JSON

Importing JSON keeps the workflows reviewable in git (you can diff
versions before importing an update) AND lets the operator tune them in
the n8n UI without committing every iteration back. The JSON in this
directory is the **starter** — the operator's live version may have
provider credentials filled in or extra Set / IF nodes. Re-export and
PR the JSON when a structural change is worth versioning.
