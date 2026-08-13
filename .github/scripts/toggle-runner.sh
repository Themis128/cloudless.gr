#!/usr/bin/env bash
# Toggle CI between GitHub-hosted runners and self-hosted pools.
#
# Why this exists:
#   GitHub Actions has no native runner-failover. When GitHub billing breaks
#   or hosted-runner capacity is exhausted, every workflow targeted at
#   `ubuntu-latest` fails fast. Flipping repo variables re-routes instrumented
#   workflows on their next run.
#
# Two independent knobs:
#   RUNNER_GENERIC — generic CI (lint/build/test style). Pi build pool only.
#   RUNNER_X64     — browser suites (Lighthouse / Playwright / a11y). Legion WSL
#                    only — NEVER point this at omv/Pi.
#
# Usage:
#   .github/scripts/toggle-runner.sh status
#   .github/scripts/toggle-runner.sh pi|hosted
#   .github/scripts/toggle-runner.sh x64-legion|x64-hosted
#
# Notes:
#   - Already-queued jobs are NOT re-routed; cancel + re-run after toggling.
#   - Opt-in:
#       runs-on: ${{ fromJSON(vars.RUNNER_GENERIC || '"ubuntu-latest"') }}
#       runs-on: ${{ fromJSON(vars.RUNNER_X64 || '"ubuntu-latest"') }}

set -euo pipefail

REPO="${REPO:-Themis128/cloudless.gr}"
VAR_GENERIC="RUNNER_GENERIC"
VAR_X64="RUNNER_X64"
PI_VALUE='["self-hosted","omv","build"]'
LEGION_VALUE='["self-hosted","legion","x64"]'

cmd="${1:-status}"

show_runners() {
  echo
  echo "Registered runners:"
  gh api "repos/${REPO}/actions/runners" \
    --jq '.runners[] | "  - \(.name): \(.status)\(if .busy then " (busy)" else "" end) — [\([.labels[].name] | join(","))]"' \
    || echo "  (unable to query — check gh auth)"
}

show_var() {
  local name="$1"
  local current
  current=$(gh variable list --repo "${REPO}" --json name,value \
    --jq ".[] | select(.name == \"${name}\") | .value" 2>/dev/null || true)
  if [[ -z "${current}" ]]; then
    echo "  ${name}: unset → ubuntu-latest"
  else
    echo "  ${name}: ${current}"
  fi
}

show_status() {
  echo "Runner variables on ${REPO}:"
  show_var "${VAR_GENERIC}"
  show_var "${VAR_X64}"
  show_runners
}

case "${cmd}" in
  status)
    show_status
    ;;
  pi|self-hosted)
    echo "==> Setting ${VAR_GENERIC}=${PI_VALUE} on ${REPO}"
    gh variable set "${VAR_GENERIC}" --repo "${REPO}" --body "${PI_VALUE}"
    echo "==> Done. Cancel + re-run any queued workflows to pick up the change."
    show_status
    ;;
  hosted|gh|github)
    echo "==> Clearing ${VAR_GENERIC} on ${REPO} (back to ubuntu-latest)"
    gh variable delete "${VAR_GENERIC}" --repo "${REPO}" 2>/dev/null || true
    show_status
    ;;
  x64-legion)
    echo "==> Setting ${VAR_X64}=${LEGION_VALUE} on ${REPO}"
    echo "    (Lighthouse / e2e / a11y only — do not use omv for these)"
    gh variable set "${VAR_X64}" --repo "${REPO}" --body "${LEGION_VALUE}"
    show_status
    ;;
  x64-hosted)
    echo "==> Clearing ${VAR_X64} on ${REPO} (browser suites → ubuntu-latest)"
    gh variable delete "${VAR_X64}" --repo "${REPO}" 2>/dev/null || true
    show_status
    ;;
  *)
    echo "Usage: $0 [status|pi|hosted|x64-legion|x64-hosted]" >&2
    exit 2
    ;;
esac
