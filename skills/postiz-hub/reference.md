# gitroomhq Postiz ecosystem — full inventory

Queried 2026-08-15 from https://github.com/gitroomhq.

## Implement for cloudless.gr

| Repo | Purpose | cloudless skill / path |
| --- | --- | --- |
| postiz-app | Scheduler core (we run v2.11.2) | `postiz`, `postiz-doctor` |
| postiz-docs | Docs source | docs.postiz.com |
| postiz-agent | `postiz` CLI + agent skill | `postiz-agent-cli`, `scripts/postiz-cli-env.sh` |
| postiz-n8n | Community n8n node | `postiz-n8n-node` |
| agent-media / agent-media-app | UGC video MCP/CLI | `postiz-agent-media` |

## Already covered in-repo (no upstream clone)

| Asset | Path |
| --- | --- |
| Public API client | `src/lib/postiz.ts` |
| Admin UI | `src/app/[locale]/admin/postiz` |
| Blog auto-post | `src/lib/postiz-blog.ts` |
| Webhooks | `src/app/api/webhooks/postiz` |
| n8n starters | `infrastructure/n8n/workflows/postiz-*.json` |
| Helm | `infrastructure/postiz/helm/postiz/` |
| Cursor MCP notes | `scripts/cursor-mcp/README-postiz.md` |

## Skip / defer

| Repo | Reason |
| --- | --- |
| postiz-docker-compose | We use k3s Helm |
| postiz-helmchart | Our chart is canonical |
| postiz-mobile | Expo app — later |
| postiz-motion-graphics-skill | Demo clips of Postiz UI, not cloudless content |
| postiz-new-support-bot | Their support product |
| loadplug | Empty/stale |
| paperclip | Multi-agent company OS — defer |
| crosspublic, trending-list, blog, devfest, wordpress-post-to-devto | Unrelated or legacy |

## npm packages

| Package | Use |
| --- | --- |
| `postiz` | Agents CLI |
| `n8n-nodes-postiz` | n8n community node |
| `@postiz/node` | Node SDK (optional alternative to raw fetch) |
| `@agentmedia/mcp-server` / `agent-media-cli` | UGC generation |

## Official install one-liners (operator machine)

```bash
pnpm add -g postiz
npx skills add gitroomhq/postiz-agent
# optional UGC:
# npx skills add gitroomhq/agent-media
# n8n UI → Community nodes → n8n-nodes-postiz
```
