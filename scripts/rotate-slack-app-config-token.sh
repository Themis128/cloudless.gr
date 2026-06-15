#!/usr/bin/env bash
#
# Rotate the Slack app-configuration token using the long-lived refresh
# token. Designed to be called from inside slack-manifest-apply.yml as a
# pre-step so the manifest API call always has a fresh ~12h access token.
#
# Reads:
#   SSM /cloudless/production/SLACK_APP_CONFIG_REFRESH_TOKEN  (SecureString)
#
# Writes (atomic — on Slack API success):
#   SSM /cloudless/production/SLACK_APP_CONFIG_TOKEN          (SecureString)
#   SSM /cloudless/production/SLACK_APP_CONFIG_REFRESH_TOKEN  (SecureString)
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

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
PREFIX="${SSM_PREFIX:-/cloudless/production}"

REFRESH_PARAM="$PREFIX/SLACK_APP_CONFIG_REFRESH_TOKEN"
ACCESS_PARAM="$PREFIX/SLACK_APP_CONFIG_TOKEN"

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

# --- Fetch refresh token ---
REFRESH=$(aws ssm get-parameter \
  --region "$REGION" \
  --name "$REFRESH_PARAM" \
  --with-decryption \
  --query Parameter.Value \
  --output text 2>/dev/null || true)

if [ -z "$REFRESH" ] || [ "$REFRESH" = "None" ]; then
  echo "::warning::No refresh token in $REFRESH_PARAM — skipping rotation."
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

# --- Persist back to SSM (write refresh FIRST — if the workflow dies
# between the two writes, the next run can still recover, because the
# refresh token in SSM matches what Slack now expects).
aws ssm put-parameter \
  --region "$REGION" \
  --name "$REFRESH_PARAM" \
  --type SecureString \
  --value "$NEW_REFRESH" \
  --overwrite >/dev/null

aws ssm put-parameter \
  --region "$REGION" \
  --name "$ACCESS_PARAM" \
  --type SecureString \
  --value "$NEW_ACCESS" \
  --overwrite >/dev/null

echo "✓ Slack app-config token rotated. New access token good for ~12h."

emit_output "token" "$NEW_ACCESS"
emit_output "rotated" "true"
