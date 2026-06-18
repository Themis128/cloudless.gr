#!/usr/bin/env bash
set -euo pipefail
RUN_ID=27795648872
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  STATUS=$(gh run view "$RUN_ID" --repo Themis128/cloudless.gr --json status -q .status)
  CONCL=$(gh run view "$RUN_ID" --repo Themis128/cloudless.gr --json conclusion -q '.conclusion // "-"')
  echo "poll $i: $STATUS $CONCL"
  if [ "$STATUS" = "completed" ]; then
    break
  fi
  sleep 25
done
gh run view "$RUN_ID" --repo Themis128/cloudless.gr --json jobs -q '.jobs[] | "\(.status) \(.conclusion // "-") \(.name)"'
