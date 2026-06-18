#!/usr/bin/env bash
# Cloudless BRANDING — one-shot installer (parks here so you can run it from cloudless.gr root).
# Run:   cd ~/code/cloudless.gr && bash install-branding.sh
# Idempotent: safe to re-run.
#
# This file is in .gitignore — won't pollute the cloudless.gr repo.

set -euo pipefail

# Hardcoded source — the Claude session's outputs folder on Windows, seen from WSL.
SRC="/mnt/c/Users/baltz/AppData/Roaming/Claude/local-agent-mode-sessions/3ec19da2-d890-4823-9585-6e9fa61beb06/1e461703-cf05-4bce-a729-e291194832f8/local_77938c64-a944-4850-9658-270a60eee238/outputs"
DST="$HOME/code/BRANDING"
LOG="$HOME/cloudless-branding-install.log"

step() { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }
ok()   { printf "  \033[1;32m✓\033[0m %s\n" "$*"; }
err()  { printf "  \033[1;31m✗\033[0m %s\n" "$*" >&2; }

step "Preflight"
test -d "$SRC/BRANDING" || { err "Source not found: $SRC/BRANDING"; err "Is the Claude outputs path correct?"; exit 1; }
test -d "$SRC/brand"    || { err "Source not found: $SRC/brand (v2 brand pack)"; exit 1; }
command -v git    >/dev/null || { err "git not installed (sudo apt install -y git)"; exit 1; }
command -v rsync  >/dev/null || { err "rsync not installed (sudo apt install -y rsync)"; exit 1; }
ok "source: $SRC"
ok "target: $DST"

step "Stage BRANDING scaffold + brand pack into $DST"
mkdir -p "$DST/cloudless-brand"
rsync -a "$SRC/BRANDING/" "$DST/"                                 # v3 scaffold
rsync -a --ignore-existing "$SRC/brand/" "$DST/cloudless-brand/"  # v2 backfill (logos, PNGs, full social set)
ok "files staged"

step "Run setup.sh (tee'd to $LOG)"
cd "$DST"
chmod +x setup.sh scripts/*.sh
bash setup.sh 2>&1 | tee "$LOG"

step "Done."
echo
echo "  Install log:    $LOG"
echo "  Verify again:   bash $DST/scripts/verify.sh"
echo "  Next on Windows:"
echo "    1. Set env vars: FIGMA_API_KEY, CANVA_CONNECT_TOKEN, BRAND_SYSTEM_API_KEY, POSTIZ_API_KEY"
echo "    2. Merge $HOME/.config/Claude/claude_desktop_config.suggested.json"
echo "       into %APPDATA%\\Claude\\claude_desktop_config.json"
echo "    3. Restart Claude Desktop"
