#!/usr/bin/env bash
# Removes the symlinks/commands placed by setup.sh. Leaves repos/ and cloudless-brand/ in place.
set -euo pipefail

BRANDING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$HOME/.claude/skills"
COMMANDS_DIR="$HOME/.claude/commands"

removed=0

echo "Removing symlinks pointing into $BRANDING_DIR ..."
if [[ -d "$SKILLS_DIR" ]]; then
  for s in "$SKILLS_DIR"/*; do
    [[ -L "$s" ]] || continue
    tgt="$(readlink -f "$s")"
    if [[ "$tgt" == "$BRANDING_DIR"* ]]; then
      rm "$s" && echo "  removed $s" && removed=$((removed+1))
    fi
  done
fi

echo "Removing slash-commands copied by setup.sh ..."
SRC="$BRANDING_DIR/repos/brand-design-skill/.claude/commands"
if [[ -d "$COMMANDS_DIR" && -d "$SRC" ]]; then
  for f in "$SRC"/*.md; do
    [[ -e "$f" ]] || continue
    name="$(basename "$f")"
    if [[ -f "$COMMANDS_DIR/$name" ]]; then
      rm "$COMMANDS_DIR/$name" && echo "  removed $COMMANDS_DIR/$name" && removed=$((removed+1))
    fi
  done
fi

echo "Done. $removed item(s) removed. Re-run setup.sh to re-install."
