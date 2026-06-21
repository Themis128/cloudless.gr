#!/usr/bin/env bash
set -u
cd /home/tbaltzakis/code/cloudless.gr
for f in a11y-audit.yml a11y-live-audit.yml bundle-budget.yml bundle-size-pr.yml links-audit.yml link-health-audit.yml notion-schema-check.yml notion-schema-drift.yml k3s-restart.yml k3s-ssh-restart.yml deploy-infrastructure.yml deploy-infrastructure-workaround.yml cloudflare-lb.yml apply-cloudflare-lb.yml secret-scan.yml secrets-check.yml; do
  if [ -f ".github/workflows/$f" ]; then
    n=$(grep -E "^name:" ".github/workflows/$f" | head -1 | sed 's/^name:[ \t]*//')
    t=$(grep -A3 "^on:" ".github/workflows/$f" | head -4 | tr "\n" " " | sed 's/  */ /g')
    printf "%-44s  %s\n  trigger: %s\n\n" "$f" "$n" "$t"
  fi
done
