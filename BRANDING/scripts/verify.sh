#!/usr/bin/env bash
# Verify which skills, commands, and MCP servers are wired up.
set -euo pipefail
SKILLS_DIR="$HOME/.claude/skills"
COMMANDS_DIR="$HOME/.claude/commands"

ok()  { printf "  \033[1;32m✓\033[0m %s\n" "$*"; }
miss(){ printf "  \033[1;31m✗\033[0m %s\n" "$*"; }

echo
echo "===== Cloudless BRANDING install report ====="
echo
echo "Skills installed under $SKILLS_DIR:"
if [[ -d "$SKILLS_DIR" ]]; then
  for s in "$SKILLS_DIR"/*; do
    [[ -e "$s" ]] || continue
    name="$(basename "$s")"
    if [[ -L "$s" ]]; then ok "$name → $(readlink "$s")"; else ok "$name (directory)"; fi
  done
else
  miss "$SKILLS_DIR does not exist"
fi

echo
echo "Slash-commands installed under $COMMANDS_DIR:"
if [[ -d "$COMMANDS_DIR" ]]; then
  for c in "$COMMANDS_DIR"/*.md; do
    [[ -e "$c" ]] || continue
    ok "/$(basename "$c" .md)"
  done
else
  miss "$COMMANDS_DIR does not exist"
fi

echo
echo "Claude Desktop MCP suggestion file:"
SUG="$HOME/.config/Claude/claude_desktop_config.suggested.json"
if [[ -f "$SUG" ]]; then ok "$SUG ($(wc -l < "$SUG") lines)"; else miss "Run setup.sh to generate it"; fi

echo
echo "Environment variables (for MCP servers):"
for v in FIGMA_API_KEY CANVA_CONNECT_TOKEN BRAND_SYSTEM_API_KEY POSTIZ_API_KEY; do
  if [[ -n "${!v:-}" ]]; then ok "$v is set"; else miss "$v is NOT set"; fi
done
echo
