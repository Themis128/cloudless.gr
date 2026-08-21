---
name: postiz-agent-cli
description: |
  Run the official Postiz Agents CLI (`postiz` from gitroomhq/postiz-agent)
  against self-hosted postiz.cloudless.gr for discover → upload → schedule →
  analytics. Use when the user says "postiz CLI", "postiz-agent", "schedule
  from terminal", "npx postiz", or wants agents to post without the Next app.
  Pair with `postiz-hub` and `postiz`.
---

# Postiz Agent CLI (cloudless.gr)

Upstream: https://github.com/gitroomhq/postiz-agent · npm: `postiz`

## Install

```bash
pnpm add -g postiz
# or: npm install -g postiz
```

Optional agent skill install (upstream packaging):

```bash
npx skills add gitroomhq/postiz-agent
```

## Auth against our self-host

Prefer **API key** (Postiz UI → Settings → Developers → Public API). Do not
commit the key.

```bash
# Source the helper (sets URL to Tailscale NodePort — bypasses CF Access)
source scripts/postiz-cli-env.sh

# Or manually:
export POSTIZ_API_KEY='…'
export POSTIZ_API_URL='http://100.74.191.58:30500'

postiz auth:status
postiz integrations:list
```

**Why Tailscale URL?** `https://postiz.cloudless.gr` is behind Cloudflare Access.
Headless CLI/agents get a 302 login page unless you attach
`CF-Access-Client-Id` / `CF-Access-Client-Secret`. NodePort on the tailnet
reaches nginx → Postiz API directly.

OAuth `postiz auth:login` targets Postiz Cloud's device-flow server by default —
for self-host, stick to `POSTIZ_API_KEY` unless you self-host the CLI auth
server (see upstream `server/SERVER.md`).

## Hard rules (from upstream — keep)

1. Authenticate before any command.
2. Always `postiz upload <file>` before attaching media; never pass raw paths/URLs to create.
3. TikTok: `content_posting_method` = `DIRECT_POST` unless the user wants inbox-only.
4. Call `postiz integrations:settings <id>` before create and honor `rules`.

## Core workflow

```bash
source scripts/postiz-cli-env.sh
postiz integrations:list
postiz integrations:settings <id>

# media
RESULT=$(postiz upload ./creative.mp4)
URL=$(echo "$RESULT" | jq -r '.path')

# schedule (see `postiz posts:create --help` for flags)
postiz posts:create -c "Caption with https://cloudless.gr/en/?utm_source=linkedin&utm_medium=social&utm_campaign=hub" \
  -i "<integration-id>" -m "$URL"

postiz analytics:platform <id> -d 30
```

## When to use CLI vs Next admin vs MCP

| Surface | Best for |
| --- | --- |
| `postiz` CLI | Scripts, CI, agent shells, one-off ops |
| Cursor MCP `postiz` | Natural-language schedule in chat |
| `/admin/postiz` | Humans / bulk UI / analytics tab |
| n8n | RSS/cron without an interactive agent |

## Troubleshooting

- Empty `integrations:list` → no channels connected, or wrong API key org.
- HTML / Access login in responses → wrong `POSTIZ_API_URL` (use Tailscale).
- Upload/post 413 → pre-upload media; don't base64 into create body.
- Rate limit on create → batch channels in one post; raise Postiz `API_LIMIT`.
