#!/usr/bin/env bash
# cowork-secrets-doctor — surface which Cowork session secrets are wired,
# which are missing, and which MCP servers will fail because of it.
#
# Reads the canonical "Cloud Session Secrets" table from CLAUDE.md and
# checks each expected env var against the current bash environment.
# Reports pass/fail and prints the corresponding fix path from the
# cowork-session-secrets skill.
#
# Usage:
#   bash scripts/cowork-secrets-doctor.sh          # check all
#   bash scripts/cowork-secrets-doctor.sh CF       # check matching names
#
# Exit code: 0 if every expected secret is present and non-empty,
# 1 if any are missing. Useful for quick CI gating.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_MD="${REPO_ROOT}/CLAUDE.md"
FILTER="${1:-}"

# ── Canonical list ────────────────────────────────────────────────────────────
# Each row: env_var | which MCP(s) consume it | what breaks if it's missing
EXPECTED=(
  "CLOUDFLARE_API_TOKEN|cloudless-infra (Cloudflare tools)|cloudflare_list_tokens / zone_settings / zone_analytics / etc. all 401"
  "GITHUB_PAT|git push / gh CLI (from the agent's bash)|push to feature branch, PR ops, workflow dispatch all fail with 401"
  "TAILSCALE_AUTH_KEY|cloudless-infra (Pi/k3s tools)|cluster_run_command / k3s_get_pods / gh_runner_health unreachable"
  "OMV_SSH_KEY_CONTENTS|cloudless-infra (SSH to omv-main)|same Pi/k3s tools — they SSH to 100.113.41.119 with this key"
)

PASS=0
FAIL=0
MISSING=()

c_ok="\033[32m"
c_err="\033[31m"
c_dim="\033[2m"
c_off="\033[0m"

printf "Cowork session secrets — health check\n"
printf "%s\n" "-------------------------------------"
if [ -n "$FILTER" ]; then
  printf "Filter: matching '%s'\n" "$FILTER"
fi

for row in "${EXPECTED[@]}"; do
  name="${row%%|*}"
  rest="${row#*|}"
  consumer="${rest%%|*}"
  impact="${rest##*|}"

  if [ -n "$FILTER" ] && [[ "$name" != *"$FILTER"* ]]; then
    continue
  fi

  val="$(printenv "$name" 2>/dev/null || true)"
  if [ -n "$val" ]; then
    masked=$(printf "%s" "$val" | head -c 4)
    len=$(printf "%s" "$val" | wc -c | tr -d ' ')
    printf "  ${c_ok}✓${c_off}  %-30s (%s…, %d chars)\n" "$name" "$masked" "$len"
    printf "       ${c_dim}consumer: %s${c_off}\n" "$consumer"
    PASS=$((PASS + 1))
  else
    printf "  ${c_err}✗${c_off}  %-30s (not set)\n" "$name"
    printf "       ${c_dim}consumer: %s${c_off}\n" "$consumer"
    printf "       ${c_dim}breaks  : %s${c_off}\n" "$impact"
    MISSING+=("$name")
    FAIL=$((FAIL + 1))
  fi
done

echo
printf "%s\n" "-------------------------------------"
printf "Pass: %d  Fail: %d\n" "$PASS" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo
  echo "Missing secrets need to be added to the Cowork session env."
  echo "Steps (from skills/cowork-session-secrets/SKILL.md):"
  echo
  echo "  1. Open the Cowork desktop app's session settings"
  echo "     (gear icon in the chat title bar, or File → Preferences → Sessions)"
  echo "  2. Open the Environment / Secrets section"
  echo "  3. Add each missing name above with its correct value"
  echo "  4. Save, close the chat, open a new one"
  echo
  echo "If you can't find the settings UI, fall back to:"
  echo "  - SSM   : aws ssm get-parameter --with-decryption --name /cloudless/production/<KEY>"
  echo "  - GitHub: gh workflow run verify-cloudflare-token.yml (etc.)"
  echo "  - Direct API: see scripts/cf-token-smoketest.sh for the curl-only pattern"
  echo
  exit 1
fi

if [ -f "$CLAUDE_MD" ]; then
  echo
  echo "Tip: keep CLAUDE.md → Cloud Session Secrets table in sync after rotations."
fi
