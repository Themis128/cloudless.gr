#!/usr/bin/env bash
# Rotate Slack app-config token using the refresh token supplied as a
# repository secret (SLACK_APP_CONFIG_REFRESH_TOKEN). Writes the new
# refresh + access tokens back to repository secrets using the GitHub CLI.
# Requires:
#   - SECRETS_PAT repo secret (personal access token with `repo` and `admin:repo_hook` or `repo` scope sufficient to set secrets)
#   - SLACK_APP_CONFIG_REFRESH_TOKEN repo secret (initial seed)
# Outputs:
#   token=<new_access_token>
#   rotated=true|false

set -uo pipefail

# Owner/repo from git remote
REPO="${GITHUB_REPOSITORY:-}"
if [ -z "$REPO" ]; then
  echo "GITHUB_REPOSITORY not set; are you running inside Actions?"
  exit 1
fi

REFRESH_ENV_NAME="SLACK_APP_CONFIG_REFRESH_TOKEN"
ACCESS_ENV_NAME="SLACK_APP_CONFIG_TOKEN"

# Read refresh token from env (workflow should provide it from repo secrets)
REFRESH="${SLACK_APP_CONFIG_REFRESH_TOKEN:-}"
if [ -z "$REFRESH" ] || [ "$REFRESH" = "None" ]; then
  echo "::warning::No refresh token in repo secret $REFRESH_ENV_NAME — skipping rotation."
  echo "rotated=false" >> "$GITHUB_OUTPUT" || true
  exit 0
fi

mask() {
  if [ -n "${GITHUB_ACTIONS:-}" ] && [ -n "$1" ]; then
    echo "::add-mask::$1"
  fi
}
mask "$REFRESH"

# Call Slack tooling.tokens.rotate
RESP=$(curl -sS -X POST "https://slack.com/api/tooling.tokens.rotate" \
  -H "Content-Type: application/x-www-form-urlencoded; charset=utf-8" \
  --data-urlencode "refresh_token=$REFRESH")

OK=$(echo "$RESP" | jq -r '.ok // false')
if [ "$OK" != "true" ]; then
  ERR=$(echo "$RESP" | jq -r '.error // "unknown"')
  echo "::error::Slack tooling.tokens.rotate failed: $ERR"
  if [ "$ERR" = "invalid_refresh_token" ] || [ "$ERR" = "token_expired" ]; then
    echo "::error::The refresh token has been revoked or rotated outside this workflow. Reseed via the Slack app UI."
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

# Authenticate gh CLI using PAT provided in SECRETS_PAT
if [ -z "${SECRETS_PAT:-}" ]; then
  echo "::error::SECRETS_PAT not provided. Workflow must set SECRETS_PAT repo secret with a PAT that can set repo secrets."
  exit 1
fi
# Login non-interactively
echo "$SECRETS_PAT" | gh auth login --with-token >/dev/null 2>&1 || {
  echo "::error::Failed to authenticate gh CLI with provided PAT"
  exit 1
}

# Update secrets in repository (overwrite)
# Use gh secret set which handles public-key encryption
printf "%s" "$NEW_REFRESH" | gh secret set $REFRESH_ENV_NAME --body - --repo "$REPO" || {
  echo "::error::Failed to set $REFRESH_ENV_NAME via gh secret"
  exit 1
}

printf "%s" "$NEW_ACCESS" | gh secret set $ACCESS_ENV_NAME --body - --repo "$REPO" || {
  echo "::error::Failed to set $ACCESS_ENV_NAME via gh secret"
  exit 1
}

echo "✓ Slack app-config token rotated and stored in repo secrets."

# Emit outputs for Actions
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "token=$NEW_ACCESS" >> "$GITHUB_OUTPUT"
  echo "rotated=true" >> "$GITHUB_OUTPUT"
fi

exit 0
