#!/usr/bin/env bash
set -euo pipefail

cd ~/code/cloudless.gr

WORKFLOWS=(
  ".github/workflows/cluster-status-audit.yml"
  ".github/workflows/deploy-alert-api.yml"
  ".github/workflows/etl-espocrm-to-lake.yml"
  ".github/workflows/rollout-pi-force.yml"
  ".github/workflows/sync-smtp-secrets.yml"
  ".github/workflows/wire-pi-cognito-from-pi.yml"
)

echo "=== Self-hosted runner risk audit ==="
echo

for f in "${WORKFLOWS[@]}"; do
  echo
  echo "===== $f ====="
  if [ ! -f "$f" ]; then
    echo "missing"
    continue
  fi

  grep -nE "^(on:|  pull_request|  pull_request_target|  issue_comment|  workflow_run|  repository_dispatch|  workflow_dispatch|  schedule|  push|permissions:|    permissions:|    runs-on:|      - self-hosted|      uses: actions/checkout|        ref:)" "$f" || true

  if grep -q "runs-on:.*self-hosted" "$f" && grep -Eq "pull_request|pull_request_target|issue_comment|workflow_run|repository_dispatch" "$f"; then
    echo "RISK: self-hosted workflow has potentially risky trigger."
  elif grep -q "runs-on:.*self-hosted" "$f"; then
    echo "OK: self-hosted runner used only by trusted operational trigger(s)."
  else
    echo "OK: no self-hosted runner detected in this workflow."
  fi
done
