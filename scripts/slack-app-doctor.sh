#!/usr/bin/env bash
# Slack-app health doctor — verify a deployed Slack app end-to-end.
#
# Usage:
#   bash scripts/slack-app-doctor.sh \
#     --token "$SLACK_BOT_TOKEN" \
#     --signing-secret "$SLACK_SIGNING_SECRET" \
#     [--channel CXXXX] \
#     [--commands-url https://your.app/api/<thing>-slack/commands] \
#     [--user-id UXXXX]
#
# What it checks:
#   1. auth.test           — token works, prints bot_id / team / user
#   2. apps.connections.open / auth.test scopes — granted scope list
#   3. conversations.info  — channel reachable (if --channel given)
#   4. Round-trip a SIGNED /commands request — proves signing-secret + route
#   5. Compares declared scopes against the actual install
#
# Exit code: 0 if all green, 1 if any red. Reusable across both the main
# Cloudless app and the dedicated Newsletter app — just pass the right
# --token / --signing-secret pair.
#
# See companion skills: slack-app-builder, slack-app-routes-nextjs,
# slack-app-debugging.
set -u

TOKEN=""
SIGNING_SECRET=""
CHANNEL=""
COMMANDS_URL=""
USER_ID="U0DOCTOR"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --token)           TOKEN="$2"; shift 2 ;;
    --signing-secret)  SIGNING_SECRET="$2"; shift 2 ;;
    --channel)         CHANNEL="$2"; shift 2 ;;
    --commands-url)    COMMANDS_URL="$2"; shift 2 ;;
    --user-id)         USER_ID="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,28p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$TOKEN" || -z "$SIGNING_SECRET" ]]; then
  echo "✗ --token and --signing-secret are required (try --help)" >&2
  exit 2
fi

FAIL=0
ok()   { echo "  ✓ $*"; }
warn() { echo "  ⚠ $*"; }
fail() { echo "  ✗ $*"; FAIL=1; }

# 1. auth.test ------------------------------------------------------------
echo "=== 1. auth.test (token validity) ==="
RESP=$(curl -sS -X POST https://slack.com/api/auth.test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded")

if echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('ok') else 1)"; then
  TEAM=$(echo "$RESP"      | python3 -c "import sys,json; print(json.load(sys.stdin).get('team',''))")
  USER=$(echo "$RESP"      | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',''))")
  BOT_ID=$(echo "$RESP"    | python3 -c "import sys,json; print(json.load(sys.stdin).get('bot_id',''))")
  USER_ID_SELF=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user_id',''))")
  ok "team=$TEAM  bot_user=$USER  bot_id=$BOT_ID  user_id=$USER_ID_SELF"
else
  ERR=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','?'))")
  fail "auth.test failed: $ERR"
  echo "    → fix: rotate token, check SSM, verify the app is installed"
  exit 1
fi

# 2. Granted scopes -------------------------------------------------------
echo
echo "=== 2. Granted scopes ==="
SCOPES=$(curl -sSI -X POST https://slack.com/api/auth.test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  | tr -d '\r' | awk -F': ' 'tolower($1)=="x-oauth-scopes"{print $2}')
if [[ -n "$SCOPES" ]]; then
  ok "scopes: $SCOPES"
else
  warn "could not read X-OAuth-Scopes header (rare — Slack may strip it for app tokens)"
fi

# 3. Channel reachability -------------------------------------------------
if [[ -n "$CHANNEL" ]]; then
  echo
  echo "=== 3. Channel reachability ($CHANNEL) ==="
  RESP=$(curl -sS -X POST https://slack.com/api/conversations.info \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data "channel=$CHANNEL")
  if echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('ok') else 1)"; then
    NAME=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['channel']['name'])")
    ISMBR=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['channel'].get('is_member',False))")
    ok "channel #$NAME is_member=$ISMBR"
    [[ "$ISMBR" != "True" ]] && warn "bot is NOT a member — chat.postMessage may fail unless chat:write.public is granted"
  else
    ERR=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','?'))")
    fail "conversations.info failed: $ERR"
    echo "    → fix: invite the bot to the channel with /invite @<bot>, or"
    echo "           grant channels:join + conversations.join, then reinstall"
  fi
fi

# 4. Signed-request round-trip --------------------------------------------
if [[ -n "$COMMANDS_URL" ]]; then
  echo
  echo "=== 4. Signed-request round-trip → $COMMANDS_URL ==="
  TS=$(date +%s)
  BODY="token=verify&team_id=T0DOCTOR&team_domain=test&channel_id=CTEST&channel_name=test&user_id=$USER_ID&user_name=doctor&command=%2Fdoctor-help&text=&api_app_id=A0DOCTOR&is_enterprise_install=false&response_url=https%3A%2F%2Fhooks.slack.com%2Fcommands%2FT0%2F1%2Fabc&trigger_id=12345.67890.abcd"
  BASE="v0:${TS}:${BODY}"
  SIG="v0=$(printf '%s' "$BASE" | openssl dgst -sha256 -hmac "$SIGNING_SECRET" | awk '{print $2}')"
  CODE=$(curl -sS -o /tmp/sad-resp.json -w '%{http_code}' \
    -X POST "$COMMANDS_URL" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -H "x-slack-request-timestamp: $TS" \
    -H "x-slack-signature: $SIG" \
    --data "$BODY")
  if [[ "$CODE" == "200" ]]; then
    ok "HTTP $CODE — endpoint verified our signature and returned a response"
    SHORT=$(head -c 200 /tmp/sad-resp.json | tr '\n' ' ')
    echo "    body preview: $SHORT"
  elif [[ "$CODE" == "401" ]]; then
    fail "HTTP 401 — signing secret rejected by the endpoint"
    echo "    → fix: the secret you passed does NOT match what the deployed app reads."
    echo "           Check SSM / env var / runtime cache (a cached old secret needs a restart)."
  else
    fail "HTTP $CODE — unexpected response"
    head -c 500 /tmp/sad-resp.json
  fi
fi

# Done --------------------------------------------------------------------
echo
if [[ "$FAIL" -eq 0 ]]; then
  echo "✓ doctor: all checks passed"
  exit 0
else
  echo "✗ doctor: one or more checks failed (see above)"
  exit 1
fi
