# Cloudless content workflow — end-to-end

Once `setup.sh` has run, the skills below are globally available in every Claude Code / Claude Agent SDK / Claude Desktop session.

## Onboarding (run once)

| Step | Command | Output |
|---|---|---|
| 1 | `/brand-onboarding` (from `social-ai-team`) | `context/brand-style.md` — pulls cloudless.gr + LinkedIn page evidence, fills the Cloudless identity. Reads `cloudless-brand/brand.md` as authoritative source if present. |
| 2 | `voice-builder` (from `social-media-skills`) | `about-me.md` + `voice.md` — based on 3-5 writing samples from Themis. Every other skill reads these. |
| 3 | `newsletter-voice` | `newsletter-voice.md` — newsletter-specific rules on top of `voice.md`. |
| 4 | `/profile-optimizer` | LinkedIn headline / about / experience rewrite + 4 image gen prompts. |

## Monthly cadence

| Step | Command | Output |
|---|---|---|
| 1 | `/content-calendar` | `context/content-calendar.md` — month of post ideas with pillar/format mix. |
| 2 | `/caption-writer` | `outputs/captions/*.md` — per-post copy with visual direction. |
| 3 | `/brand-design` (slash command) | Self-contained HTML cards (1080×1080, 1200×630, 1584×396) using **Cloudless brand tokens**. |
| 4 | `/social-creative-designer` | AI image / composite / brand overlay / stop-motion reel via the Nano Banana MCP. |
| 5 | Postiz (via Postiz MCP or the `postiz` CLI) | Schedules each post on the right channel + date. |
| 6 | `analytics-dashboard` | LinkedIn export → interactive React dashboard + 5 recommendations. |

## End-of-month

| Step | Command | Output |
|---|---|---|
| 1 | `/social-performance-review` | `outputs/reviews/<month>.md` — top + bottom performers, pillar/format patterns, ranked recommendations. |
| 2 | Auto-updates | `context/best-performers.md` — feeds back into next month's `/caption-writer`. |

## How skills find the Cloudless brand pack

`setup.sh` symlinks `~/.claude/skills/cloudless-brand/` to this repo's `cloudless-brand/`. Every skill listed above reads `cloudless-brand/brand.md` before drafting:

- `voice-builder` uses §6 (voice & tone) as the seed voice rules.
- `/brand-design` replaces its default tokens with §2 (colors) and §3 (typography).
- `/social-creative-designer` reads §5 (surface dimensions) for canvas sizing.
- `/content-calendar` reads §6.3 (branded conventions) for hashtag set + signature line.
- `/social-performance-review` reads §11 (accessibility checklist) before flagging issues.

## Channels active (Postiz integrations on omv)

| Channel | Postiz ID | Voice mode |
|---|---|---|
| LinkedIn Page · cloudless.gr | `cmqaxib15000alz7gll7ex3qt` | corporate |
| LinkedIn Personal · Themistoklis | `cmqaxhor20008lz7go1ghiomv` | practitioner / direct |
| Facebook · Cloudless.gr | `cmqaq5vmj0001lz7gflfmprd3` | corporate |

X / IG / Threads / Bluesky are **not yet connected** — add the OAuth in Postiz UI when ready, then add IDs here.

## Reference

- `cloudless-brand/brand.md` — the v2 brand reference (read by every skill).
- `repos/awesome-claude-skills/brand-guidelines/SKILL.md` — Composio's template for brand-guidelines skills (for inspiration).
- `repos/awesome-mcp-servers/` — canonical MCP server list (browse for new connectors).
- `repos/awesome-agent-skills/` — 1000+ skills catalog (browse for new capabilities).
