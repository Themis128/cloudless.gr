#!/usr/bin/env bash
set -u
cd /home/tbaltzakis/code/cloudless.gr
# Check potential dupes — show top comment / on: trigger of each pair
for pair in "a11y-audit.yml a11y-live-audit.yml" "bundle-budget.yml bundle-size-pr.yml" "links-audit.yml link-health-audit.yml" "notion-schema-check.yml notion-schema-drift.yml" "k3s-restart.yml k3s-ssh-restart.yml" "deploy-infrastructure.yml deploy-infrastructure-workaround.yml" "cloudflare-lb.yml apply-cloudflare-lb.yml" "secret-scan.yml secrets-check.yml" "deploy-pi.yml build-pi-image.yml rollout-pi-force.yml"; do
  echo "=== $pair ==="
  for f in $pair; do
    if [ -f ".github/workflows/$f" ]; then
      first_real=$(grep -nE "^name:|^on:" ".github/workflows/$f" | head -2 | tr "\n" " | ")
      echo "  $f → $first_real"
    fi
  done
done
echo
echo "=== workflows NOT triggered in 60+ days ==="
cutoff=$(date -u -d "60 days ago" +%Y-%m-%d)
for wf in $(ls .github/workflows/*.yml | xargs -n1 basename); do
  raw=$(gh run list --workflow="$wf" --limit 1 --json createdAt 2>/dev/null)
  if [ -z "$raw" ] || [ "$raw" = "[]" ]; then
    echo "  $wf  NEVER"
  else
    d=$(echo "$raw" | python3 -c 'import sys,json; r=json.load(sys.stdin); print(r[0]["createdAt"][:10])' 2>/dev/null)
    if [ -n "$d" ] && [[ "$d" < "$cutoff" ]]; then
      echo "  $wf  $d"
    fi
  fi
done | head -20
