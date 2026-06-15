#!/usr/bin/env bash
# E2E test of the live /cloudless-newsletter Slack surface against prod.
# Reads SLACK_SIGNING_SECRET from SSM, signs a request, hits prod, prints reply.
set -u
SS=$(aws ssm get-parameter --region us-east-1 \
  --name /cloudless/production/SLACK_SIGNING_SECRET \
  --with-decryption --query Parameter.Value --output text)
if [[ -z "$SS" ]]; then
  echo "✗ Could not read SLACK_SIGNING_SECRET from SSM"; exit 1
fi
echo "secret length: ${#SS}"

TS=$(date +%s)
BODY='token=verification-token&team_id=T123&team_domain=cloudless&channel_id=C0BBDKY6Q9E&channel_name=newsletter&user_id=U09AF5VU7LY&user_name=themis&command=%2Fcloudless-newsletter&text=list&api_app_id=A09AAAAAAAA&is_enterprise_install=false&response_url=https%3A%2F%2Fhooks.slack.com%2Fcommands%2FT123%2F12345%2Fabc&trigger_id=12345.67890.abcd'

BASE="v0:${TS}:${BODY}"
SIG="v0=$(printf '%s' "$BASE" | openssl dgst -sha256 -hmac "$SS" | awk '{print $2}')"

echo "ts=$TS  sig=${SIG:0:18}…"

CODE=$(curl -sS -o /tmp/cmd-list.json -w '%{http_code}' \
  -X POST https://cloudless.gr/api/slack/commands \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H "x-slack-request-timestamp: $TS" \
  -H "x-slack-signature: $SIG" \
  --data "$BODY")

echo "HTTP: $CODE"
echo '--- response body ---'
head -c 3000 /tmp/cmd-list.json
echo
