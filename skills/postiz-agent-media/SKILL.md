---
name: postiz-agent-media
description: |
  Generate short-form UGC / podcast video via gitroomhq agent-media (MCP or
  CLI), then publish through self-hosted Postiz. Use when the user wants
  "UGC video", "TikTok creative", "agent-media", "make_ugc", or video → social
  for cloudless.gr. Pair with `postiz-hub`, `postiz-agent-cli`, `postiz`.
---

# agent-media → Postiz (cloudless.gr)

Upstream:

- https://github.com/gitroomhq/agent-media (skills mirror)
- https://github.com/gitroomhq/agent-media-app (product / self-host)
- Hosted MCP: `https://api.agent-media.ai/mcp` (OAuth) or API key `ma_…`

This is **optional and credit-billed** (agent-media.ai). Prefer it when you need
finished vertical video faster than Postiz's built-in generators. Stay on our
Postiz v2.11.2 for publishing.

## When to use vs Postiz built-in AI

| Need | Use |
| --- | --- |
| Quick image / short AI clip inside Postiz | Postiz `OPENAI_API_KEY` / fal / in-app tools |
| Lip-synced UGC / multi-take vertical | **agent-media** `make_ugc` |
| Two-speaker podcast cut | agent-media `make_podcast` |
| Schedule to LinkedIn/X/IG/TikTok | **Postiz** (CLI / MCP / admin / n8n) |

## Cursor setup

```jsonc
// ~/.cursor/mcp.json
"agent-media": { "url": "https://api.agent-media.ai/mcp" }
```

Or: `npx skills add gitroomhq/agent-media` / `gitroomhq/agent-media-app`.

Complete browser OAuth when Cursor prompts. Do not commit `ma_` tokens.

## Generation flow

1. Ask the user if they want **captions** (opt-in; never force).
2. Call `make_ugc` with full `script` + `person` / `image` / `character`.
3. Poll until `succeeded`; take `final_output.video_url`.
4. Download or pass URL into Postiz:

```bash
source scripts/postiz-cli-env.sh
# Prefer download → postiz upload (providers want Postiz-hosted media)
curl -L "$VIDEO_URL" -o /tmp/ugc.mp4
PATH_JSON=$(postiz upload /tmp/ugc.mp4)
MEDIA=$(echo "$PATH_JSON" | jq -r '.path')
postiz integrations:list
postiz posts:create -c "<caption + UTM link>" -i "<tiktok-or-ig-id>" -m "$MEDIA"
```

Always append cloudless UTMs per `postiz-automation`:

```
https://cloudless.gr/en/?utm_source=tiktok&utm_medium=social&utm_campaign=<slug>
```

## agent-media's own social_publish

agent-media can also `social_publish` to channels it OAuth'd. For the **hub**,
prefer **Postiz** as the single scheduler of record so calendar, plugs, webhooks,
and `/admin/postiz` stay consistent. Use agent-media social only for experiments.

## Self-hosting agent-media-app

Possible (see their ARCHITECTURE / docker-compose) but **not** on the Pi5 with
Postiz — GPU/credits stack. Use hosted agent-media.ai unless a separate box exists.
