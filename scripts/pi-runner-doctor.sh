#!/usr/bin/env bash
# pi-runner-doctor.sh — diagnose Pi-runner outages + auto-remediate.
#
# Companion to skills/pi-runner-failover/SKILL.md.
#
# Usage:
#   bash scripts/pi-runner-doctor.sh           # diagnose only
#   bash scripts/pi-runner-doctor.sh --auto-flip   # also flip RUNNER_GENERIC to
#                                                  # hosted if BOTH Pi runners
#                                                  # are offline.
#
# Exit codes:
#   0  Pi runners healthy OR auto-flip succeeded
#   2  Pi runners offline AND --auto-flip not passed (operator must decide)
#   3  Pi runners healthy but RUNNER_GENERIC is pointing at hosted
#      (unusual — may be a leftover from a recent flip)

set -uo pipefail

# Resolve to repo root regardless of invocation directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

REPO="${REPO:-Themis128/cloudless.gr}"
AUTO_FLIP=0
if [[ "${1:-}" == "--auto-flip" ]]; then
  AUTO_FLIP=1
fi

echo "=== Pi runner doctor ==="
echo "Repo: $REPO"
echo

# ---- 1. Runner status ----------------------------------------------------
echo "## 1. Self-hosted runners"
RUNNERS_JSON=$(gh api "/repos/$REPO/actions/runners" 2>&1)
if [[ "$RUNNERS_JSON" == *"error"* ]] || [[ -z "$RUNNERS_JSON" ]]; then
  echo "  ! Failed to fetch runner list: $RUNNERS_JSON"
  exit 1
fi

echo "$RUNNERS_JSON" | jq -r '.runners[] | "  - \(.name): status=\(.status) busy=\(.busy) labels=" + ([.labels[].name] | join(","))'

PI_ONLINE=$(echo "$RUNNERS_JSON" | jq -r '[.runners[] | select((.labels[].name=="pi") and .status=="online")] | length')
PI_OFFLINE=$(echo "$RUNNERS_JSON" | jq -r '[.runners[] | select((.labels[].name=="pi") and .status=="offline")] | length')

echo
echo "Pi runners: $PI_ONLINE online, $PI_OFFLINE offline"
echo

# ---- 2. RUNNER_GENERIC variable -----------------------------------------
echo "## 2. RUNNER_GENERIC repo variable"
RG_VALUE=$(gh variable get RUNNER_GENERIC 2>/dev/null || echo "")
if [[ -z "$RG_VALUE" ]]; then
  echo "  RUNNER_GENERIC is UNSET → flexible workflows use ubuntu-latest"
  RG_MODE="hosted"
else
  echo "  RUNNER_GENERIC = $RG_VALUE"
  RG_MODE="pi"
fi
echo

# ---- 3. Queued workflows -------------------------------------------------
echo "## 3. Workflows currently queued"
QUEUED=$(gh run list --status queued --limit 30 \
  --json databaseId,workflowName,createdAt 2>/dev/null || echo "[]")
COUNT=$(echo "$QUEUED" | jq 'length')
if [[ "$COUNT" -eq 0 ]]; then
  echo "  (none)"
else
  echo "$QUEUED" | jq -r '.[] | "  - \(.databaseId)\t\(.workflowName)\t(\(.createdAt))"'
fi
echo

# ---- 4. Hard-pinned-to-Pi workflows (inventory) --------------------------
echo "## 4. Workflows pinned to [self-hosted, omv, pi, *]"
if [[ -d ".github/workflows" ]]; then
  grep -l "runs-on:.*self-hosted.*omv.*pi\|runs-on:.*omv.*pi.*build" \
    .github/workflows/*.yml 2>/dev/null | sed 's|.github/workflows/||; s/^/  - /' || echo "  (none)"
fi
echo

# ---- 5. Recommendation ---------------------------------------------------
echo "## 5. Recommendation"
if [[ "$PI_OFFLINE" -gt 0 ]] && [[ "$PI_ONLINE" -eq 0 ]]; then
  echo "  ALL Pi runners offline."
  if [[ "$RG_MODE" == "pi" ]]; then
    echo "      RUNNER_GENERIC is still pointing at Pi labels — flexible"
    echo "      workflows will queue forever until a Pi runner comes back."
    echo
    if [[ "$AUTO_FLIP" -eq 1 ]]; then
      echo "  -> Flipping RUNNER_GENERIC to hosted (--auto-flip)..."
      .github/scripts/toggle-runner.sh hosted 2>&1 | tail -5
      echo
      echo "  Done. Now cancel any queued runs and re-trigger them."
      exit 0
    else
      echo "  -> Run with --auto-flip to flip RUNNER_GENERIC to hosted, OR"
      echo "    run manually: .github/scripts/toggle-runner.sh hosted"
      echo
      echo "  Then cancel queued runs targeting Pi and re-trigger them."
      echo "  See skills/pi-runner-failover/SKILL.md for the full playbook."
      exit 2
    fi
  else
    echo "      RUNNER_GENERIC is already on hosted - flexible workflows OK."
    echo "      Hard-pinned workflows (Section 4) are still stuck until"
    echo "      a Pi runner comes back. See SKILL.md Step 4 for restore."
    exit 0
  fi
elif [[ "$PI_ONLINE" -gt 0 ]] && [[ "$RG_MODE" == "hosted" ]]; then
  echo "  Pi runners are healthy but RUNNER_GENERIC is on hosted."
  echo "      This is fine, but if you want to push load back to Pi:"
  echo "      .github/scripts/toggle-runner.sh pi"
  exit 3
else
  echo "  Pi runners healthy. No action needed."
  exit 0
fi
