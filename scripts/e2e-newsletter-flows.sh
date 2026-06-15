#!/usr/bin/env bash
# Hits every /cloudless-newsletter subcommand variant against prod with a real
# Slack-signed request. Send-with-bogus-slug confirms the not-found path
# without actually publishing.
set -u
SS=$(aws ssm get-parameter --region us-east-1 \
  --name /cloudless/production/SLACK_SIGNING_SECRET \
  --with-decryption --query Parameter.Value --output text)

post() {
  local LABEL="$1"; local TEXT="$2"
  local TS BODY BASE SIG CODE
  TS=$(date +%s)
  BODY="token=verification-token&team_id=T123&team_domain=cloudless&channel_id=C0BBDKY6Q9E&channel_name=newsletter&user_id=U09AF5VU7LY&user_name=themis&command=%2Fcloudless-newsletter&text=${TEXT}&api_app_id=A09AAAAAAAA&is_enterprise_install=false&response_url=https%3A%2F%2Fhooks.slack.com%2Fcommands%2FT123%2F12345%2Fabc&trigger_id=12345.67890.abcd"
  BASE="v0:${TS}:${BODY}"
  SIG="v0=$(printf '%s' "$BASE" | openssl dgst -sha256 -hmac "$SS" | awk '{print $2}')"
  CODE=$(curl -sS -o /tmp/r.json -w '%{http_code}' \
    -X POST https://cloudless.gr/api/slack/commands \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -H "x-slack-request-timestamp: $TS" \
    -H "x-slack-signature: $SIG" \
    --data "$BODY")
  echo
  echo "=== $LABEL → HTTP $CODE ==="
  python3 -c "import json; d=json.load(open('/tmp/r.json')); txt=[b.get('text',{}).get('text','') for b in d.get('blocks',[]) if isinstance(b.get('text'),dict)]; print('\n'.join(txt[:6]) if txt else d.get('text', json.dumps(d)[:400]))" 2>/dev/null || head -c 500 /tmp/r.json
}

post "list"                 "list"
post "no-args (help)"       ""
post "send no-slug"         "send"
post "send bogus-slug"      "send%20does-not-exist-12345"
post "unpublish no-slug"    "unpublish"
post "unpublish bogus-slug" "unpublish%20does-not-exist-12345"
echo
echo '✓ e2e flow probe complete'
