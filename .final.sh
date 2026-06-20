#!/usr/bin/env bash
cd /home/tbaltzakis/code/cloudless.gr
echo "=== run 27874166506 (post-fix HA sync) ==="
gh run view 27874166506 --json status,conclusion,jobs --jq '"status=" + .status + "  conclusion=" + (.conclusion // "-")' 2>&1
echo "  steps:"
gh run view 27874166506 --json jobs --jq '.jobs[0].steps[] | "    " + .name + " → " + .status + "/" + (.conclusion // "-")' 2>&1
echo
echo "=== currently in-flight ==="
gh run list --branch=main --limit=15 --json status,name --jq '.[] | select(.status=="in_progress" or .status=="queued" or .status=="pending") | .status + " | " + .name'
echo
echo "=== last 4 HA sync runs ==="
gh run list --workflow="HA sync orchestrator" --branch=main --limit=4 --json status,conclusion,createdAt,databaseId \
  --jq '.[] | (.createdAt + " id=" + (.databaseId|tostring) + " " + .status + "/" + (.conclusion // "-"))'
