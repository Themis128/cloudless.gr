---
name: postiz-n8n-node
description: |
  Install and operate the official Postiz n8n community node (gitroomhq/postiz-n8n)
  plus cloudless.gr starter workflows (RSS multichannel, UTM guard). Use when
  wiring "n8n Postiz", "RSS to social", "n8n-nodes-postiz", or cron posting
  without the Next.js app. Pair with `postiz-hub`, `postiz-automation`, `n8n-operator`.
---

# Postiz × n8n (cloudless.gr)

Upstream node: https://github.com/gitroomhq/postiz-n8n · npm `n8n-nodes-postiz`

Our n8n: https://n8n.cloudless.gr · manifests `infrastructure/n8n/`

## Install community node (preferred UX)

1. Open n8n → **Settings → Community nodes → Install**
2. Package: `n8n-nodes-postiz`
3. Credential **Postiz API**:
   - API key from Postiz → Settings → Developers → Public API
   - Host **must end with `/api`**:
     - In-cluster: `http://postiz.postiz.svc.cluster.local:5000/api`
     - Or public (needs Access token/bypass): `https://postiz.cloudless.gr/api`

`N8N_COMMUNITY_PACKAGES_ENABLED=true` is already set on the n8n Deployment.

## Starter workflows (git)

| File | Purpose |
| --- | --- |
| `infrastructure/n8n/workflows/postiz-rss-multichannel.json` | Cron → RSS → Postiz multi-channel schedule (HTTP Request; works without community node) |
| `infrastructure/n8n/workflows/postiz-utm-guard.json` | Postiz publish webhook → Slack if UTM missing |

Import: n8n → Workflows → Import from File → Activate.

Env already on the Deployment:

- `POSTIZ_API_BASE=http://postiz.postiz.svc.cluster.local:5000`
- `POSTIZ_RSS_FEED_URL=https://cloudless.gr/en/blog/rss.xml`
- `POSTIZ_CHANNEL_IDENTIFIERS=linkedin,linkedin-page,x,bluesky`

Override in n8n Variables if needed. Replace placeholder credential IDs after import.

## When to use HTTP Request vs community node

| Approach | Use when |
| --- | --- |
| HTTP Request (current JSON) | Portable; already matches Public API |
| `n8n-nodes-postiz` | Operators want Postiz-native node UI |

Both talk to the same Public API. Prefer in-cluster DNS so n8n never hits Cloudflare Access.

## Built-in Postiz RSS vs n8n

Postiz UI also has RSS auto-post. Use **one** source of truth:

- n8n → when you need filters, Slack, EspoCRM, or multi-step AI rewrite
- Postiz RSS → when you want the simplest feed → calendar path

## Verify

1. Connect ≥1 channel matching `POSTIZ_CHANNEL_IDENTIFIERS`
2. Run the RSS workflow manually once
3. Confirm a `QUEUE`/`schedule` post in Postiz or `/admin/postiz`
