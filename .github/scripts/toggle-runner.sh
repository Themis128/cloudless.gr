#!/usr/bin/env bash
# Toggle CI between GitHub-hosted runners and the self-hosted Pi `build` cluster.
#
# Why this exists:
#   GitHub Actions has no native runner-failover. When GitHub billing breaks
#   or hosted-runner capacity is exhausted, every workflow targeted at
#   `ubuntu-latest` fails fast with "the job was not started because recent
#   account payments have failed". Flipping the `RUNNER_GENERIC` repo variable
#   re-routes all instrumented workflows to the Pi runners on their next run.
#
# Usage:
#   .github/scripts/toggle-runner.sh status   # show current setting + runner inventory
#   .github/scripts/toggle-runner.sh pi       # route generic jobs to Pi build runners
#   .github/scripts/toggle-runner.sh hosted   # route generic jobs back to ubuntu-latest (clears the var)
#
# Notes:
#   - Already-queued jobs are NOT re-routed; cancel + re-run them after toggling.
#   - Workflows must opt in by using:
#       runs-on: ${{ fromJSON(vars.RUNNER_GENERIC || '"ubuntu-latest"') }}
#   - Jobs that genuinely require x86_64 or more RAM than a Pi has (Lighthouse,
#     CodeQL, heavy Playwright matrices) should keep a hard `runs-on: ubuntu-latest`.

set -euo pipefail

REPO="${REPO:-Themis128/cloudless.gr}"
VAR_NAME="RUNNER_GENERIC"
PI_VALUE='["self-hosted","omv","build"]'

cmd="${1:-status}"

show_runners() {
  echo
  echo "Registered runners:"
  gh api "repos/${REPO}/actions/runners" \
    --jq '.runners[] | "  - \(.name): \(.status)\(if .busy then " (busy)" else "" end) — [\([.labels[].name] | join(","))]"' \
    || echo "  (unable to query — check gh auth)"
}

show_status() {
  current=$(gh variable list --repo "${REPO}" --json name,value \
    --jq ".[] | select(.name == \"${VAR_NAME}\") | .value" 2>/dev/null || true)
  if [[ -z "${current}" ]]; then
    echo "Mode: HOSTED (ubuntu-latest)  —  ${VAR_NAME} is unset"
  else
    echo "Mode: SELF-HOSTED  —  ${VAR_NAME}=${current}"
  fi
  show_runners
}

case "${cmd}" in
  status)
    show_status
    ;;
  pi|self-hosted)
    echo "==> Setting ${VAR_NAME}=${PI_VALUE} on ${REPO}"
    gh variable set "${VAR_NAME}" --repo "${REPO}" --body "${PI_VALUE}"
    echo "==> Done. Cancel + re-run any queued workflows to pick up the change."
    show_status
    ;;
  hosted|gh|github)
    echo "==> Clearing ${VAR_NAME} on ${REPO} (back to ubuntu-latest)"
    gh variable delete "${VAR_NAME}" --repo "${REPO}" 2>/dev/null || true
    show_status
    ;;
  *)
    echo "Usage: $0 [status|pi|hosted]" >&2
    exit 2
    ;;
esac
