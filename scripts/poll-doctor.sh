#!/usr/bin/env bash
# Polling helper: runs the doctor every 90s until HEALTHY or 15 polls (22.5 min).
set -uo pipefail
cd "$(dirname "$0")/.."
for i in $(seq 1 15); do
  printf "=== poll %d @ %s ===\n" "$i" "$(date -u +%H:%M:%SZ)"
  out="$(bash scripts/linkedin-insight-doctor.sh --slug shop-online --locale el --no-color 2>&1)"
  status=$?
  printf '%s\n' "$out" | grep -E 'Partner ID literal|verdict|HEALTHY|DEGRADED' | head -5
  if [ "$status" -eq 0 ]; then
    echo "=== HEALTHY — stopping ==="
    exit 0
  fi
  sleep 90
done
echo "=== exhausted polls; check deploy state manually ==="
exit 1
