#!/usr/bin/env bash
set -u
cd /home/tbaltzakis/code/cloudless.gr
for wf in apply-cloudflare-lb.yml deploy-infrastructure-workaround.yml a11y-live-audit.yml bootstrap-gh-runners.yml k3s-ssh-restart.yml bundle-size-pr.yml notion-schema-drift.yml analytics-etl.yml ad-readiness.yml ci-babysitter.yml restart-pi-runners.yml stale-gate-sweeper.yml devcontainer.yml pi-auth-logs.yml; do
  raw=$(gh run list --workflow="$wf" --limit 1 --json createdAt,conclusion 2>/dev/null)
  if [ -z "$raw" ] || [ "$raw" = "[]" ]; then
    info="NEVER RUN"
  else
    info=$(echo "$raw" | python3 -c 'import sys,json; r=json.load(sys.stdin); print(r[0]["createdAt"][:10], r[0].get("conclusion") or "(in progress)")')
  fi
  printf "%-44s  %s\n" "$wf" "$info"
done
