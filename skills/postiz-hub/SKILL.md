---
name: postiz-hub
description: |
  Umbrella skill for turning self-hosted Postiz (postiz.cloudless.gr, v2.11.2)
  into the cloudless.gr social media hub. Catalogs every gitroomhq Postiz-related
  GitHub repo, what to implement vs skip, and which sibling skills to open.
  Use when the user says "Postiz hub", "Postiz plugins", "Postiz ecosystem",
  "postiz-agent", "agent-media", "all Postiz repos", or "make Postiz our social
  media hub". Pair with `postiz`, `postiz-doctor`, `postiz-automation`,
  `postiz-agent-cli`, `postiz-agent-media`, `postiz-n8n-node`.
---

# Postiz hub — cloudless.gr ecosystem map

Self-hosted Postiz is pinned at **v2.11.2** on omv k3s. Do **not** jump to
v2.12+ without Temporal capacity. Hub value comes from **channels + automation
plugins**, not from upgrading the app image.

## Live constraints (check first)

| Check | Expected |
| --- | --- |
| Image | `ghcr.io/gitroomhq/postiz-app:v2.11.2` |
| Public URL | `https://postiz.cloudless.gr` (Cloudflare Access) |
| Agent/CLI bypass | `http://100.74.191.58:30500` (Tailscale NodePort) |
| MCP | Cursor `postiz` → Tailscale `/api/mcp/<key>` |
| Channels | Must be >0 in Postiz UI / `integrationList` |
| `postiz-providers` Secret | Must hold FACEBOOK_*, LINKEDIN_*, X_*, TIKTOK_* (not only API key) |

If channels are empty or OAuth fails → `postiz-doctor`, then restore provider secrets.

## gitroomhq repos — implement vs skip

| Repo | Stars-ish role | cloudless.gr action |
| --- | --- | --- |
| [postiz-app](https://github.com/gitroomhq/postiz-app) | Core scheduler | **Operate** via `postiz` + Helm; stay on v2.11.2 |
| [postiz-docs](https://github.com/gitroomhq/postiz-docs) | Official docs | **Reference** only |
| [postiz-agent](https://github.com/gitroomhq/postiz-agent) | `postiz` CLI + agent skill | **Install + use** → `postiz-agent-cli` |
| [postiz-n8n](https://github.com/gitroomhq/postiz-n8n) | `n8n-nodes-postiz` | **Install on n8n** → `postiz-n8n-node` |
| [agent-media](https://github.com/gitroomhq/agent-media) / [agent-media-app](https://github.com/gitroomhq/agent-media-app) | UGC video MCP/CLI | **Optional paid** → `postiz-agent-media` |
| [postiz-docker-compose](https://github.com/gitroomhq/postiz-docker-compose) | Upstream compose | **Skip** — we use k3s Helm |
| [postiz-helmchart](https://github.com/gitroomhq/postiz-helmchart) | Upstream Helm | **Skip** — `infrastructure/postiz/helm/postiz/` is canonical |
| [postiz-mobile](https://github.com/gitroomhq/postiz-mobile) | Expo mobile app | **Skip** for now (Pi/ops focus) |
| [postiz-motion-graphics-skill](https://github.com/gitroomhq/postiz-motion-graphics-skill) | Demo MP4 catalog of Postiz UI | **Skip** — marketing Postiz itself, not cloudless content |
| [postiz-new-support-bot](https://github.com/gitroomhq/postiz-new-support-bot) | Their support bot | **Skip** |
| [loadplug](https://github.com/gitroomhq/loadplug) | Empty/stale | **Skip** |
| [paperclip](https://github.com/gitroomhq/paperclip) | Multi-agent “company” orchestrator | **Defer** — interesting later, not required for social hub |
| [crosspublic](https://github.com/gitroomhq/crosspublic) / [trending-list](https://github.com/gitroomhq/trending-list) | Unrelated products | **Skip** |
| [wordpress-post-to-devto](https://github.com/gitroomhq/wordpress-post-to-devto) | WP→DEV.to | **Skip** unless WordPress becomes a CMS |

## Built-in Postiz features (no extra repo)

Enable in the Postiz UI once channels exist:

1. **Plugs** — auto-repost / auto-comment (X, LinkedIn Page, Bluesky, Threads)
2. **RSS auto-post** — or use our n8n RSS workflow
3. **Webhooks** — already partially wired (`postiz-utm-guard`)
4. **MCP** — Cursor already configured
5. **Public API** — `src/lib/postiz.ts` + `/admin/postiz`
6. **AI / R2 / Polotno / short-links** — env on the Postiz Deployment (see docs configuration reference)

## Sibling skills (open the right one)

| Need | Skill |
| --- | --- |
| Deploy / channels / OAuth / Helm | `postiz` |
| Outage / empty channels / 502 | `postiz-doctor` |
| UTM, Slack, EspoCRM attribution | `postiz-automation` |
| CLI scheduling from agent/shell | `postiz-agent-cli` |
| UGC video → schedule | `postiz-agent-media` |
| n8n community node + RSS | `postiz-n8n-node` |

## Hub implementation order (do in order)

1. Restore `postiz-providers` OAuth keys (`scripts/postiz-restore-providers.sh`); connect **P0**: LinkedIn Page, X, FB/IG, Bluesky — see `docs/integrations/POSTIZ-CONNECT.md`.
2. Confirm MCP `integrationList` and `/admin/postiz` Channels are non-empty (`scripts/postiz-connect-ready.sh`).
3. Install `postiz` CLI with Tailscale `POSTIZ_API_URL` (`postiz-agent-cli`).
4. Import + activate `postiz-rss-multichannel.json` + `postiz-utm-guard.json`; optionally install `n8n-nodes-postiz`. In-cluster API base: `http://postiz.postiz.svc.cluster.local:5000/api`.
5. Register Postiz → app webhook (`scripts/postiz-register-webhook.sh`) and Plugs for X + LinkedIn Page.
6. Keep `AUTO_POST_BLOG_TO_SOCIAL` **unset** on cloudless-app unless you want AppFlowy Published → social fan-out (default = vet-before-post).
7. Optional: agent-media MCP for short-form video creatives, then publish via Postiz.
8. Optional: `OPENAI_API_KEY` + R2 on the Postiz pod for in-app AI/media.

## cloudless.gr surfaces that already talk to Postiz

- `src/lib/postiz.ts` — Public API client (incl. bulk, analytics, `withSocialUtm`)
- `src/app/[locale]/admin/postiz` — compose / bulk / analytics UI
- `src/lib/postiz-blog.ts` — AppFlowy/CMS Published → social (opt-in flag)
- `src/app/api/webhooks/postiz` — inbound webhooks
- `src/app/api/webhooks/content` + `setEditorialStatus(Published)` — trigger share
- `infrastructure/n8n/workflows/postiz-*.json` — automation starters
- Cursor MCP server `postiz`
- `docs/integrations/POSTIZ-CONNECT.md` — operator connect checklist

## Do not

- Upgrade past v2.11.2 without a Temporal plan
- Commit API keys or put them in repo `mcp.json`
- Use public `https://postiz.cloudless.gr` from headless agents without CF Access service token — prefer Tailscale NodePort or Access headers
- Enable `AUTO_POST_BLOG_TO_SOCIAL=1` without connected channels + vetted copy