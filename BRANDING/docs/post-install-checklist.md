# Post-install checklist

After `setup.sh` finishes, work through this list. Each box maps to a concrete action you do once.

## In WSL

- [ ] `bash scripts/verify.sh` shows ≥ 20 skills installed and `/brand-design` present.
- [ ] `~/.claude/skills/cloudless-brand/brand.md` opens and reads as the v2 brand doc.
- [ ] Env vars set in `~/.bashrc`: `FIGMA_API_KEY`, `CANVA_CONNECT_TOKEN`, `BRAND_SYSTEM_API_KEY`, `POSTIZ_API_KEY`.

## In Claude Desktop (Windows)

- [ ] `%APPDATA%\Claude\claude_desktop_config.json` has the four MCP servers (`figma`, `canva`, `brand-system`, `postiz`) merged in alongside Adobe.
- [ ] Set the same env vars as Windows user env vars (System Properties → Environment Variables) so Claude Desktop picks them up.
- [ ] Restart Claude Desktop.
- [ ] In a new chat, type `/` — `/brand-design` and the social-ai-team slash-commands appear.
- [ ] Ask Claude: "Run `voice-builder` for Cloudless." — voice setup starts; reads `cloudless-brand/brand.md`.

## In your Cloudless content workflow

- [ ] Run `/brand-onboarding` once. Confirm it picks up cloudless.gr's site evidence and writes `context/brand-style.md` that references the v2 brand pack.
- [ ] Run `voice-builder` with 3–5 of Themis' best LinkedIn posts and blog excerpts as input. Save the resulting `voice.md` to the BRANDING project (or to a Cloudless-specific workspace).
- [ ] Run `/content-calendar` for July 2026 and review.
- [ ] Run `/caption-writer` for one post, then `/brand-design` for it. Visually compare the output card to `cloudless-brand/social/preview-social-card-linkedin-1200x630.html`.
- [ ] Schedule one test post in Postiz via the MCP server (or the CLI) to confirm the full chain works end-to-end.

## In Postiz (postiz.cloudless.gr)

- [ ] LinkedIn Page, LinkedIn Personal, Facebook integrations are already connected (confirmed in DB).
- [ ] Generate a Postiz API key (Settings → API) — should match `edd2c4f5…` already in the cluster DB.
- [ ] Anthropic credits topped up (already done).
- [ ] Optional next steps: connect X, Instagram, Threads, Bluesky in Postiz UI; add their integration IDs to `docs/workflow.md`.
