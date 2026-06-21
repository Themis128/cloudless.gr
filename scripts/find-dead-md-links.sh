#!/usr/bin/env bash
# Find dead `[text](path)` markdown links across the repo.
cd "$(dirname "$0")/.."
for f in CLAUDE.md docs/HUBSPOT.md docs/NEWSLETTER.md docs/runners.md docs/AGENCY-HUB.md docs/ROADMAP-ONE-STOP-SHOP.md infrastructure/espocrm/README.md skills/espocrm-operator/SKILL.md; do
  [[ -f "$f" ]] || continue
  echo "=== $f ==="
  grep -nE 'weekly-subscriber|hubspot\.ts' "$f" 2>/dev/null | head -5
done
