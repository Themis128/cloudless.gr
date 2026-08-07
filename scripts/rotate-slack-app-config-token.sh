#!/usr/bin/env bash
#
# Rotate the Slack app-configuration token using the long-lived refresh
# token. Designed to be called from inside slack-manifest-apply.yml as a
# pre-step so the manifest API call always has a fresh ~12h access token.
#
# Reads:
#   D1 app_config: slack_app_config_refresh_token
#
# Writes (atomic — on Slack API success):
#   Wrangler secret: SLACK_APP_CONFIG_TOKEN
#   D1 app_config:   slack_app_config_token
#   Wrangler secret: SLACK_APP_CONFIG_REFRESH_TOKEN
#   D1 app_config:   slack_app_config_refresh_token
#
# Outputs to GITHUB_OUTPUT (when run in a workflow):
#   token=<new_access_token>      — masked, available to subsequent steps
#   rotated=true|false            — false on graceful no-op
#
# Exit codes:
#   0 — success, or graceful skip (no refresh token present yet)
#   1 — Slack API rejected the refresh token (refresh token has been
#       revoked or rotated elsewhere); a human must reseed via
#       scripts/seed-slack-app-config-tokens.sh
#
# Slack endpoint: POST https://slack.com/api/tooling.tokens.rotate
# Docs: https://api.slack.com/methods/tooling.tokens.rotate

set -uo pipefail

source "$(dirname "$0")/lib/cf-secrets.sh"

REFRESH_CONFIG_KEY="slack_app_config_refresh_token"
ACCESS_CONFIG_KEY="slack_app_config_token"

emit_output() {
  local key="$1" value="$2"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "${key}=${value}" >>"$GITHUB_OUTPUT"
  fi
}

mask() {
  # ::add-mask:: hides the value from GH Actions logs. No-op outside CI.
  if [ -n "${GITHUB_ACTIONS:-}" ] && [ -n "$1" ]; then
    echo "::add-mask::$1"
  fi
}

# --- Fetch refresh token from D1 ---
REFRESH=$(cf_config_get SLACK_APP_CONFIG_REFRESH_TOKEN)

if [ -z "$REFRESH" ] || [ "$REFRESH" = "null" ]; then
  echo "::warning::No refresh token in D1 config ($REFRESH_CONFIG_KEY) — skipping rotation."
  echo "  Bootstrap with: bash scripts/seed-slack-app-config-tokens.sh"
  emit_output "rotated" "false"
  exit 0
fi
mask "$REFRESH"

# --- Call Slack API ---
#
# Per https://docs.slack.dev/reference/methods/tooling.tokens.rotate the
# refresh token is passed as a form argument (refresh_token=...), NOT as a
# Bearer Authorization header. "No scopes required" — auth is the refresh
# token itself, validated server-side.
RESP=$(curl -sS -X POST "https://slack.com/api/tooling.tokens.rotate" \
  -H "Content-Type: application/x-www-form-urlencoded; charset=utf-8" \
  --data-urlencode "refresh_token=$REFRESH")

OK=$(echo "$RESP" | jq -r '.ok // false')
if [ "$OK" != "true" ]; then
  ERR=$(echo "$RESP" | jq -r '.error // "unknown"')
  echo "::error::Slack tooling.tokens.rotate failed: $ERR"
  if [ "$ERR" = "invalid_refresh_token" ] || [ "$ERR" = "token_expired" ]; then
    echo "::error::The refresh token has been revoked or rotated outside this workflow."
    echo "::error::Reseed both tokens at https://api.slack.com/apps → Your App → Basic Information"
    echo "::error::then run: bash scripts/seed-slack-app-config-tokens.sh"
  fi
  exit 1
fi

NEW_ACCESS=$(echo "$RESP" | jq -r '.token')
NEW_REFRESH=$(echo "$RESP" | jq -r '.refresh_token')

if [ -z "$NEW_ACCESS" ] || [ "$NEW_ACCESS" = "null" ]; then
  echo "::error::Slack response missing .token field"
  exit 1
fi
mask "$NEW_ACCESS"
mask "$NEW_REFRESH"

# --- Persist back to Cloudflare (write refresh FIRST — if the workflow dies
# between the two writes, the next run can still recover, because the
# refresh token in D1 matches what Slack now expects).
cf_verify_auth || exit 1

echo -n "Writing new refresh token... "
cf_config_set "SLACK_APP_CONFIG_REFRESH_TOKEN" "$NEW_REFRESH" && echo -n "D1 ok " || echo -n "D1 failed "
cf_secret_set "SLACK_APP_CONFIG_REFRESH_TOKEN" "$NEW_REFRESH" && echo "Wrangler ok" || echo "Wrangler failed"

echo -n "Writing new access token... "
cf_config_set "SLACK_APP_CONFIG_TOKEN" "$NEW_ACCESS" && echo -n "D1 ok " || echo -n "D1 failed "
cf_secret_set "SLACK_APP_CONFIG_TOKEN" "$NEW_ACCESS" && echo "Wrangler ok" || echo "Wrangler failed"

echo "✓ Slack app-config token rotated. New access token good for ~12h."

emit_output "token" "$NEW_ACCESS"
emit_output "rotated" "true"