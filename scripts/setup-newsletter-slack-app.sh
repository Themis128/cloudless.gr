#!/usr/bin/env bash
# Bootstrap the DEDICATED Newsletter Slack app secrets into SSM + GH.
#
# Run AFTER installing the app at https://api.slack.com/apps from
# slack-newsletter-app.manifest.json. Copy the bot token + signing secret
# from the app's settings pages, then run:
#
#   bash scripts/setup-newsletter-slack-app.sh \
#     --bot-token       "xoxb-..." \
#     --signing-secret  "32-char-hex" \
#     --channel         "C0BBDKY6Q9E"    # the #newsletter channel ID
#
# What it does:
#   1. Stores NEWSLETTER_SLACK_BOT_TOKEN, NEWSLETTER_SLACK_SIGNING_SECRET,
#      and NEWSLETTER_SLACK_CHANNEL_ID into AWS SSM at
#      /cloudless/production/NEWSLETTER_SLACK_*
#   2. Calls auth.test to verify the bot token + prints granted scopes
#   3. Smoke-tests the signing secret by signing a request and posting it
#      to the live /api/newsletter-slack/commands endpoint
#   4. Posts a Block Kit "hello" to the #newsletter channel so you can see
#      the new bot's avatar appear
#
# This script is idempotent — re-running it after a token rotation will
# overwrite the SSM values cleanly.
#
# See companion: scripts/slack-app-doctor.sh (re-checkable health probe).
set -u

BOT_TOKEN=""
SIGNING_SECRET=""
CHANNEL=""
ENDPOINT="https://cloudless.gr/api/newsletter-slack/commands"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bot-token)       BOT_TOKEN="$2"; shift 2 ;;
    --signing-secret)  SIGNING_SECRET="$2"; shift 2 ;;
    --channel)         CHANNEL="$2"; shift 2 ;;
    --endpoint)        ENDPOINT="$2"; shift 2 ;;
    -h|--help)         sed -n '2,28p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$BOT_TOKEN" || -z "$SIGNING_SECRET" || -z "$CHANNEL" ]]; then
  echo "✗ --bot-token, --signing-secret, and --channel are all required" >&2
  echo "  Try --help for the full usage." >&2
  exit 2
fi

REGION="${AWS_REGION:-us-east-1}"

# ---------------------------------------------------------------------------
# 1. Verify the bot token works (auth.test)
# ---------------------------------------------------------------------------
echo "=== 1. auth.test (verify bot token before we store it) ==="
RESP=$(curl -sS -X POST https://slack.com/api/auth.test \
  -H "Authorization: Bearer $BOT_TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded")
OK=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok',False))")
if [[ "$OK" != "True" ]]; then
  ERR=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','?'))")
  echo "  ✗ auth.test failed: $ERR — refusing to store an invalid token" >&2
  exit 1
fi
TEAM=$(echo "$RESP"    | python3 -c "import sys,json; print(json.load(sys.stdin).get('team',''))")
BOT_USER=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',''))")
echo "  ✓ team=$TEAM  bot_user=$BOT_USER"

# ---------------------------------------------------------------------------
# 2. Store secrets in SSM
# ---------------------------------------------------------------------------
echo
echo "=== 2. Storing secrets in SSM (region $REGION) ==="
for pair in \
  "NEWSLETTER_SLACK_BOT_TOKEN:$BOT_TOKEN:SecureString" \
  "NEWSLETTER_SLACK_SIGNING_SECRET:$SIGNING_SECRET:SecureString" \
  "NEWSLETTER_SLACK_CHANNEL_ID:$CHANNEL:String"
do
  NAME="${pair%%:*}"
  REST="${pair#*:}"
  VALUE="${REST%:*}"
  TYPE="${REST##*:}"
  SSM_PATH="/cloudless/production/$NAME"
  aws ssm put-parameter --region "$REGION" \
    --name "$SSM_PATH" --type "$TYPE" --value "$VALUE" --overwrite \
    >/dev/null
  echo "  ✓ $SSM_PATH ($TYPE)"
done

# ---------------------------------------------------------------------------
# 3. Smoke-test the signed-request round-trip against the deployed endpoint
# ---------------------------------------------------------------------------
echo
echo "=== 3. Signed-request smoke test → $ENDPOINT ==="
TS=$(date +%s)
BODY="token=verify&team_id=T0BOOT&team_domain=test&channel_id=$CHANNEL&channel_name=newsletter&user_id=U0BOOT&user_name=bootstrap&command=%2Fnewsletter-help&text=&api_app_id=A0BOOT&is_enterprise_install=false&response_url=https%3A%2F%2Fhooks.slack.com%2Fcommands%2FT0%2F1%2Fabc&trigger_id=12345.67890.abcd"
BASE="v0:${TS}:${BODY}"
SIG="v0=$(printf '%s' "$BASE" | openssl dgst -sha256 -hmac "$SIGNING_SECRET" | awk '{print $2}')"
CODE=$(curl -sS -o /tmp/setup-newsletter-resp.json -w '%{http_code}' \
  -X POST "$ENDPOINT" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H "x-slack-request-timestamp: $TS" \
  -H "x-slack-signature: $SIG" \
  --data "$BODY")
if [[ "$CODE" == "200" ]]; then
  echo "  ✓ HTTP 200 — endpoint verified signature using the SSM-stored secret"
elif [[ "$CODE" == "401" ]]; then
  echo "  ⚠ HTTP 401 — endpoint rejected signature."
  echo "    Reason: the Lambda may be reading a cached old secret. Wait ~5 min"
  echo "    for the SSM cache to expire OR redeploy the app to force a re-read."
else
  echo "  ⚠ HTTP $CODE — unexpected"
  head -c 400 /tmp/setup-newsletter-resp.json
fi

# ---------------------------------------------------------------------------
# 4. Post a "hello" message to #newsletter so the bot avatar appears
# ---------------------------------------------------------------------------
echo
echo "=== 4. chat.postMessage to $CHANNEL (hello) ==="
RESP=$(curl -sS -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $BOT_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{
    \"channel\": \"$CHANNEL\",
    \"text\": \":newspaper: Newsletter app installed — try \`/newsletter-help\` or open the App Home (:house: tab).\",
    \"blocks\": [
      {
        \"type\": \"header\",
        \"text\": { \"type\": \"plain_text\", \"text\": \":newspaper: Newsletter app installed\", \"emoji\": true }
      },
      {
        \"type\": \"section\",
        \"text\": {
          \"type\": \"mrkdwn\",
          \"text\": \"This is the dedicated Newsletter Slack app — separate from the main Cloudless app, with its own signing secret and bot token.\\n\\nTry:\\n• \`/newsletter-help\` — list all commands\\n• \`/newsletter-list\` — pending drafts + gate verdicts\\n• \`/newsletter-stats\` — subscribers + drafts + cadence\\n• Open the :house: Home tab — live 3-layer dashboard\"
        }
      }
    ]
  }")
HELLO_OK=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok',False))")
if [[ "$HELLO_OK" == "True" ]]; then
  echo "  ✓ hello posted to $CHANNEL"
else
  ERR=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','?'))")
  echo "  ⚠ chat.postMessage failed: $ERR"
  echo "    Common fixes:"
  echo "    • Invite the bot to the channel via '/invite @<bot>'"
  echo "    • Add chat:write.public scope + reinstall"
fi

echo
echo "✓ bootstrap complete. Next steps:"
echo "  • Open Slack → Apps → Newsletter → Home tab — should show the 3-layer dashboard"
echo "  • Re-run the doctor anytime:"
echo "      bash scripts/slack-app-doctor.sh \\"
echo "        --token \"$BOT_TOKEN\" \\"
echo "        --signing-secret \"$SIGNING_SECRET\" \\"
echo "        --channel \"$CHANNEL\" \\"
echo "        --commands-url $ENDPOINT"
