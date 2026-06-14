#!/usr/bin/env bash
#
# One-time bootstrap for the Slack app-config token pair.
#
# Slack app-configuration tokens expire every 12 hours, but they come
# with a long-lived refresh token. After this seed runs once, the
# rotate-slack-app-config-token.sh script (called from
# slack-manifest-apply.yml) keeps the access token fresh automatically.
#
# HOW TO MINT THE TOKEN PAIR (browser, ~30s):
#
#   1. https://api.slack.com/apps  →  Your Apps page (NOT inside a specific app)
#   2. Click "Refresh Tokens" or "Generate Tokens" in the top-right.
#   3. Select workspace "cloudless.gr" (or your dev workspace).
#   4. Copy the two values that appear:
#        - "Access Token"   (xoxe.xoxp-...)  — short-lived, ~12h
#        - "Refresh Token"  (xoxe-...)       — long-lived
#   5. Run this script. It will prompt for both (input hidden).
#
# Both values are written as SecureString to:
#   /cloudless/production/SLACK_APP_CONFIG_TOKEN
#   /cloudless/production/SLACK_APP_CONFIG_REFRESH_TOKEN

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
PREFIX="${SSM_PREFIX:-/cloudless/production}"

if ! command -v aws >/dev/null; then
  echo "ERROR: aws CLI not found." >&2; exit 1
fi
if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "ERROR: AWS credentials not configured. Run 'aws configure' first." >&2; exit 1
fi

if [ -t 0 ]; then
  read -r -s -p "Paste Slack ACCESS token (xoxe.xoxp-...): " ACCESS
  echo
  read -r -s -p "Paste Slack REFRESH token (xoxe-...): " REFRESH
  echo
else
  echo "ERROR: stdin is not a tty — this script expects interactive paste." >&2
  exit 1
fi

if [ -z "$ACCESS" ] || [ -z "$REFRESH" ]; then
  echo "ERROR: both tokens are required." >&2; exit 1
fi

case "$ACCESS" in xoxe.xoxp-*) : ;; *) echo "WARN: access token prefix is not xoxe.xoxp- — continuing anyway." >&2 ;; esac
case "$REFRESH" in xoxe-*) : ;; *) echo "WARN: refresh token prefix is not xoxe- — continuing anyway." >&2 ;; esac

# --- Verify the access token works ---
echo -n "Verifying access token against Slack apps.manifest.validate ... "
HTTP=$(curl -s -o /tmp/.slack-probe.json -w "%{http_code}" \
  -X POST https://slack.com/api/auth.test \
  -H "Authorization: Bearer $ACCESS")
if [ "$HTTP" != "200" ]; then
  echo "FAILED (HTTP $HTTP)"; cat /tmp/.slack-probe.json >&2; rm -f /tmp/.slack-probe.json; exit 1
fi
OK=$(jq -r .ok /tmp/.slack-probe.json)
TEAM=$(jq -r '.team // ""' /tmp/.slack-probe.json)
rm -f /tmp/.slack-probe.json
if [ "$OK" != "true" ]; then echo "FAILED (Slack: $(jq -r .error 2>/dev/null))"; exit 1; fi
echo "ok (team: $TEAM)"

# --- Write both to SSM ---
echo -n "Writing $PREFIX/SLACK_APP_CONFIG_REFRESH_TOKEN ... "
aws ssm put-parameter --region "$REGION" \
  --name "$PREFIX/SLACK_APP_CONFIG_REFRESH_TOKEN" \
  --type SecureString --value "$REFRESH" --overwrite >/dev/null
echo "ok"

echo -n "Writing $PREFIX/SLACK_APP_CONFIG_TOKEN ... "
aws ssm put-parameter --region "$REGION" \
  --name "$PREFIX/SLACK_APP_CONFIG_TOKEN" \
  --type SecureString --value "$ACCESS" --overwrite >/dev/null
echo "ok"

echo
echo "Done. Next run of slack-manifest-apply.yml will auto-rotate the access"
echo "token via tooling.tokens.rotate — no further manual steps needed."
