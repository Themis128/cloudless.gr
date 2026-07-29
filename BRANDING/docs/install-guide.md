# Install guide

## Prerequisites

```bash
sudo apt-get update
sudo apt-get install -y git rsync
# Optional but recommended:
sudo apt-get install -y nodejs npm  # for MCP servers that run via npx
```

## 1. Place the project

From your Windows file explorer or in WSL:

```bash
mkdir -p ~/code/BRANDING
# Then copy the entire BRANDING/ from your Claude outputs folder into ~/code/BRANDING/
```

## 2. Run setup

```bash
cd ~/code/BRANDING
chmod +x setup.sh scripts/*.sh
bash setup.sh
```

The script is idempotent — re-run any time to pull updates from the cloned repos and re-link.

## 3. Set MCP server env vars

Add to your shell profile (`~/.bashrc` or `~/.zshrc`) — these are consumed by Claude Desktop **on its next start**, so set them before restarting the app.

```bash
export FIGMA_API_KEY="figd_…"           # https://www.figma.com/developers/api#access-tokens
export CANVA_CONNECT_TOKEN="…"          # https://www.canva.dev/docs/connect/
export BRAND_SYSTEM_API_KEY="…"         # Brand System MCP signup
export POSTIZ_API_KEY="edd2c4f5…"       # already in your cluster — see Postiz Org table
```

## 4. Merge MCP config into Claude Desktop

On Windows, open:

```
%APPDATA%\Claude\claude_desktop_config.json
```

Merge the `mcpServers` block from `claude-desktop-mcp.json` into the existing file. **Do not overwrite** — preserve your existing entries (Adobe, Postiz, etc.).

Restart Claude Desktop.

## 5. Verify

```bash
bash ~/code/BRANDING/scripts/verify.sh
```

Should print every installed skill, slash-command, and which env vars are set.

In Claude Desktop, type `/` and you should see:

- `/brand-design` (from `VicUgochukwu/brand-design-skill`)
- `/brand-onboarding`, `/social-media-manager`, `/content-calendar`, `/caption-writer`, `/social-creative-designer`, `/social-performance-review` (from `social-ai-team`)

And ask Claude: "What skills do you have for brand voice?" — you should see `voice-builder`, `newsletter-voice`, `post-writer`, `cloudless-brand`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `setup.sh: line N: ln: command not found` | `apt-get install coreutils` |
| Skills don't appear in Claude after restart | Check `~/.claude/skills/` — every entry should be a working symlink. Re-run setup. |
| `/brand-design` doesn't work | Check `~/.claude/commands/brand-design.md` exists and is readable. |
| MCP server `figma` shows "failed to start" in Claude Desktop logs | `FIGMA_API_KEY` not visible to Claude Desktop. Set it as a Windows user env var (System Properties → Environment Variables), then restart. |
| Cloned repo conflict | `cd repos/<name> && git reset --hard origin/main && cd ../.. && bash setup.sh` |
