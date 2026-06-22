#!/usr/bin/env bash
# Render every social card template under cloudless-brand/social/ to PNG.
# Output lands in cloudless-brand/social-cards/.
# Requires chromium (apt install chromium) and a 64-bit Linux.
set -euo pipefail

BRANDING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$BRANDING_DIR/cloudless-brand/social"
OUT="$BRANDING_DIR/cloudless-brand/social-cards"
mkdir -p "$OUT"

CHROME="$(command -v chromium || command -v chromium-browser || command -v google-chrome)"
[[ -z "$CHROME" ]] && { echo "Install chromium first: apt-get install -y chromium" >&2; exit 1; }

declare -A SIZES=(
  ["preview-social-card-linkedin-1200x630.html"]="1200,630"
  ["preview-social-card-square-1080x1080.html"]="1080,1080"
  ["preview-linkedin-banner-1584x396.html"]="1584,396"
  ["preview-linkedin-feed-1200x1200.html"]="1200,1200"
  ["preview-portrait-1080x1350.html"]="1080,1350"
  ["preview-story-1080x1920.html"]="1080,1920"
  ["preview-x-header-1500x500.html"]="1500,500"
  ["preview-x-instream-1600x900.html"]="1600,900"
)

for html in "${!SIZES[@]}"; do
  src="$SRC/$html"
  [[ -f "$src" ]] || { echo "  ! $html missing — skipping"; continue; }
  out="$OUT/${html%.html}.png"
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --window-size="${SIZES[$html]}" --screenshot="$out" \
    --virtual-time-budget=2000 "file://$src" 2>/dev/null
  printf "  ✓ %-50s → %s\n" "$html" "$(stat -c%s "$out") bytes"
done

echo
echo "All cards rendered into $OUT"
