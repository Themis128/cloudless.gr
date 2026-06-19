#!/usr/bin/env bash
# Watch for deploy completion: poll workflow + SSM + live bundle every 90s.
# Exits 0 when bundle contains the Partner ID literal.
set -uo pipefail
RUN_ID=27816302967
TARGET_SHA="4291d493e943"

for i in $(seq 1 20); do
  echo "=== try $i @ $(date -u +%H:%M:%SZ) ==="

  status=$(gh run view "$RUN_ID" --repo Themis128/cloudless.gr --json status --jq '.status' 2>/dev/null || echo "?")
  concl=$(gh run view "$RUN_ID" --repo Themis128/cloudless.gr --json conclusion --jq '.conclusion' 2>/dev/null || echo "?")
  echo "workflow: status=$status conclusion=$concl"

  pi_sha=$(aws ssm get-parameter --name /cloudless/production/pi-sha --region us-east-1 --query 'Parameter.Value' --output text 2>/dev/null || echo "?")
  echo "pi-sha SSM: $pi_sha"

  # Probe live bundle for Partner ID literal
  out=$(bash scripts/linkedin-insight-doctor.sh --slug shop-online --locale el --no-color 2>&1)
  echo "$out" | grep -E 'Partner ID literal|HEALTHY|NOT HEALTHY' | head -3

  if echo "$out" | grep -q 'Partner ID literal found in bundle'; then
    echo "=== ✓ Partner ID is in the live bundle. STOPPING ==="
    exit 0
  fi

  if [ "$pi_sha" = "$TARGET_SHA" ] && [ "$status" = "completed" ]; then
    echo "=== Deploy finished but live bundle still missing Partner ID — investigate ==="
  fi

  sleep 90
done
echo "=== exhausted polls (30 min) — escalate ==="
exit 1
