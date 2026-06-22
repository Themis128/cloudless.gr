#!/usr/bin/env bash
# BRANDING — one-shot installer.
# Idempotent: safe to re-run. Tested on Ubuntu 24.04 / WSL2.
set -euo pipefail

BRANDING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$HOME/.claude/skills"
COMMANDS_DIR="$HOME/.claude/commands"
SUGGESTED_MCP="$HOME/.config/Claude/claude_desktop_config.suggested.json"

# <local-dir>|<git-url>|<install-strategy>
#   skills-dir — symlink every directory under repos/<name>/skills/ into $SKILLS_DIR
#   commands   — copy .md files under repos/<name>/.claude/commands/ into $COMMANDS_DIR
#   reference  — clone only; don't install
REPOS=(
  "social-media-skills|https://github.com/charlie947/social-media-skills.git|skills-dir"
  "social-ai-team|https://github.com/stevenflanagan1/social-ai-team.git|skills-dir"
  "brand-design-skill|https://github.com/VicUgochukwu/brand-design-skill.git|commands"
  "awesome-claude-skills|https://github.com/ComposioHQ/awesome-claude-skills.git|reference"
  "awesome-agent-skills|https://github.com/VoltAgent/awesome-agent-skills.git|reference"
  "awesome-mcp-servers|https://github.com/punkpeye/awesome-mcp-servers.git|reference"
)

step() { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }
ok()   { printf "  \033[1;32m✓\033[0m %s\n" "$*"; }
warn() { printf "  \033[1;33m!\033[0m %s\n" "$*"; }
err()  { printf "  \033[1;31m✗\033[0m %s\n" "$*" >&2; }

step "Preflight"
command -v git   >/dev/null || { err "git not installed"; exit 1; }
command -v rsync >/dev/null || { err "rsync not installed (apt-get install rsync)"; exit 1; }
mkdir -p "$SKILLS_DIR" "$COMMANDS_DIR" "$BRANDING_DIR/repos" "$(dirname "$SUGGESTED_MCP")"
ok "git: $(git --version | awk '{print $3}')"
ok "skills dir: $SKILLS_DIR"
ok "commands dir: $COMMANDS_DIR"

step "Clone external repos"
cd "$BRANDING_DIR/repos"
for entry in "${REPOS[@]}"; do
  IFS='|' read -r name url strategy <<< "$entry"
  if [[ -d "$name/.git" ]]; then
    ( cd "$name" && git pull --ff-only --quiet ) || warn "pull failed for $name (continuing)"
    ok "$name (updated)"
  else
    git clone --depth 1 --quiet "$url" "$name" && ok "$name (cloned)"
  fi
done

step "Wire Cloudless brand pack into ~/.claude/skills/"
ln -sfn "$BRANDING_DIR/cloudless-brand" "$SKILLS_DIR/cloudless-brand"
ok "~/.claude/skills/cloudless-brand → $BRANDING_DIR/cloudless-brand"

step "Install Claude Code skills globally (symlinks under ~/.claude/skills/)"
for entry in "${REPOS[@]}"; do
  IFS='|' read -r name url strategy <<< "$entry"
  [[ "$strategy" == "skills-dir" ]] || continue
  src="$BRANDING_DIR/repos/$name/skills"
  if [[ ! -d "$src" ]]; then warn "$name has no skills/ folder — skipping"; continue; fi
  for skill_path in "$src"/*; do
    [[ -d "$skill_path" ]] || continue
    skill_name="$(basename "$skill_path")"
    ln -sfn "$skill_path" "$SKILLS_DIR/$skill_name"
    ok "~/.claude/skills/$skill_name → $name/skills/$skill_name"
  done
done

step "Install slash-commands globally (~/.claude/commands/)"
for entry in "${REPOS[@]}"; do
  IFS='|' read -r name url strategy <<< "$entry"
  [[ "$strategy" == "commands" ]] || continue
  src="$BRANDING_DIR/repos/$name/.claude/commands"
  if [[ ! -d "$src" ]]; then warn "$name has no .claude/commands/ — skipping"; continue; fi
  rsync -a --quiet "$src/" "$COMMANDS_DIR/"
  ok "Copied $(ls "$src" | wc -l) command(s) from $name → $COMMANDS_DIR/"
done

step "Write suggested Claude Desktop MCP config"
cp "$BRANDING_DIR/claude-desktop-mcp.json" "$SUGGESTED_MCP"
ok "Wrote $SUGGESTED_MCP"
cat <<'NOTE'

  Next: merge the JSON in claude-desktop-mcp.json into the real config on your
  Windows host at:

      %APPDATA%\Claude\claude_desktop_config.json

  Open it, merge the "mcpServers" object into the existing "mcpServers"
  (don't overwrite — preserve your Adobe / Postiz entries), and RESTART
  Claude Desktop.

  Required env vars (set BEFORE restarting Claude Desktop):
    FIGMA_API_KEY        — https://www.figma.com/developers/api#access-tokens
    CANVA_CONNECT_TOKEN  — https://www.canva.dev/docs/connect/
    BRAND_SYSTEM_API_KEY — Brand System MCP key
    POSTIZ_API_KEY       — already in your cluster (see Postiz DB)

NOTE

step "Verify install"
bash "$BRANDING_DIR/scripts/verify.sh" || true

step "Done."
echo "  Read docs/workflow.md to see the end-to-end flow."
