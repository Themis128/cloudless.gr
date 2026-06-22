# BRANDING — Cloudless brand + social-media skill workspace

A single project that bundles **every Claude Desktop / Claude Code branding & social-media skill** worth running for cloudless.gr, the **Cloudless brand pack v2**, and the **Claude Desktop MCP server snippet** to wire it all into the desktop app.

## Layout

```
BRANDING/
├── cloudless-brand/                  # Brand pack v2 source-of-truth
├── repos/                            # External skill repos (populated by setup.sh)
├── scripts/                          # Install + verify + uninstall scripts
├── claude-desktop-mcp.json           # MCP server JSON snippet for Claude Desktop
├── setup.sh                          # One-shot installer
└── docs/                             # Workflow + install guide + post-install checklist
```

## Install (one command)

```bash
cd ~/code/BRANDING && bash setup.sh
```

The script will:

1. Clone six external repos into `repos/`.
2. Symlink every skill into `~/.claude/skills/` — **available globally** across every Claude Code / Claude Agent SDK session.
3. Copy slash-commands (`/brand-design`) into `~/.claude/commands/`.
4. Symlink the **Cloudless brand pack** into `~/.claude/skills/cloudless-brand/` so any skill can read `brand.md`, the SVG logos and the social templates without leaving the agent.
5. Print the Claude Desktop MCP-server JSON to merge into `%APPDATA%\Claude\claude_desktop_config.json` (also written to `~/.config/Claude/claude_desktop_config.suggested.json` for reference).
6. Run `scripts/verify.sh`.

**Restart Claude Desktop once** after install for the MCP servers to register.

## What gets installed globally

| Layer | Source | Adds |
|---|---|---|
| Skills | `charlie947/social-media-skills` | `voice-builder`, `newsletter-voice`, `profile-optimizer`, `post-writer`, `graphic-designer`, `post-scorer`, `reels-scripting`, `youtube-thumbnail`, `pinned-comment`, `hook-generator`, `post-formatter`, `content-matrix`, `niche-research`, `gemini-infographic`, `gemini-carousel`, `quote-post`, `analytics-dashboard` |
| Skills | `stevenflanagan1/social-ai-team` | `social-media-manager` (orchestrator), `brand-onboarding`, `content-calendar`, `caption-writer`, `social-creative-designer`, `social-performance-review` |
| Skill | this repo | `cloudless-brand` (brand pack v2: `brand.md` + logos + social card HTML + favicon kit) |
| Commands | `VicUgochukwu/brand-design-skill` | `/brand-design` slash command |
| Reference | `ComposioHQ/awesome-claude-skills` | `brand-guidelines` SKILL.md template |
| Reference | `VoltAgent/awesome-agent-skills` | 1000+ skills catalog |
| Reference | `punkpeye/awesome-mcp-servers` | canonical MCP server list |

## MCP servers added to Claude Desktop

| Server | Adds | Required env |
|---|---|---|
| `figma` | Read components/variables; write designs back | `FIGMA_API_KEY` |
| `canva` | Generate designs, edit templates, export | `CANVA_CONNECT_TOKEN` |
| `brand-system` | Extract brand identity from cloudless.gr → design tokens | `BRAND_SYSTEM_API_KEY` |
| `postiz` | Postiz publishing + analytics (cloudless.gr stack) | `POSTIZ_API_KEY` |
| `adobe-for-creativity` | ✅ already installed (OAuth done) | — |

Servers whose required env var is missing are skipped silently by Claude Desktop — no crash.

## Workflow after install

`/brand-onboarding` (once, captures Cloudless identity) → `voice-builder` (once, ingests Themis' writing samples) → **monthly**: `/content-calendar` → `/caption-writer` → `/brand-design` → Postiz publishes → `/social-performance-review` at month-end.

See `docs/workflow.md` for the full diagram.

## Uninstall

```bash
bash scripts/uninstall.sh
```

Removes the symlinks under `~/.claude/skills/` and the copied commands under `~/.claude/commands/`. Leaves `repos/` and `cloudless-brand/` intact.
