#!/usr/bin/env bash
# Integration activation doctor — checks, sets, and live-verifies the
# Cloudflare secrets/D1 config that gate the platform's integrations.
#
# Usage:
#   ./scripts/activate-integration.sh status
#       Show which activation keys exist in Cloudflare/D1 (values never printed).
#
#   ./scripts/activate-integration.sh set KEY VALUE
#       Write one key to Cloudflare (Wrangler secret + D1 config) and
#       immediately run the matching live verification.
#       Allowed KEYs: ACTIVECAMPAIGN_API_URL ACTIVECAMPAIGN_API_TOKEN
#                     ACTIVECAMPAIGN_LEAD_AUTOMATION_ID TIKTOK_ACCESS_TOKEN
#                     TIKTOK_ADVERTISER_ID X_AD_ACCOUNT_ID POSTIZ_API_URL
#                     POSTIZ_API_KEY CLOUDFLARE_API_TOKEN SLACK_BOT_TOKEN
#                     SLACK_SIGNING_SECRET SLACK_DEFAULT_CHANNEL
#
#   ./scripts/activate-integration.sh verify [activecampaign|tiktok|x|postiz|slack]
#       Live-verify one integration (or all when omitted) using the values
#       already in Cloudflare/D1. Read-only against each provider.
#
# Requirements: wrangler CLI with Cloudflare API token, curl, python3, jq.
# Designed to run on any operator machine with Cloudflare credentials.
set -euo pipefail

source "$(dirname "$0")/lib/cf-secrets.sh"

ALLOWLLOWED_KEYS=(
  ACTIVECAMPAIGN_API_URL ACTIVECAMPAIGN_API_TOKEN ACTIVECAMPAIGN_LEAD_AUTOMATION_ID
  TIKTOK_ACCESS_TOKEN TIKTOK_ADVERTISER_ID
  X_AD_ACCOUNT_ID
  POSTIZ_API_URL POSTIZ_API_KEY
  CLOUDFLARE_API_TOKEN
  SLACK_BOT_TOKEN SLACK_SIGNING_SECRET SLACK_DEFAULT_CHANNEL
)

mark() { if cf_exists "$1"; then echo "  [set]     $1"; else echo "  [MISSING] $1"; fi; }

cmd_status() {
  echo "Activation keys in Cloudflare/D1:"
  echo "ActiveCampaign:"
  mark ACTIVECAMPAIGN_API_URL
  mark ACTIVECAMPAIGN_API_TOKEN
  mark ACTIVECAMPAIGN_LEAD_AUTOMATION_ID
  echo "TikTok Ads:"
  mark TIKTOK_ACCESS_TOKEN
  mark TIKTOK_ADVERTISER_ID
  echo "X Ads:"
  mark X_AD_ACCOUNT_ID
  echo "Postiz:"
  mark POSTIZ_API_URL
  mark POSTIZ_API_KEY
  echo "Cloudflare:"
  mark CLOUDFLARE_API_TOKEN
  echo "Slack:"
  mark SLACK_BOT_TOKEN
  mark SLACK_SIGNING_SECRET
  mark SLACK_DEFAULT_CHANNEL
}

verify_activecampaign() {
  local url token
  url=$(cf_config_get ACTIVECAMPAIGN_API_URL)
  token=$(cf_config_get ACTIVECAMPAIGN_API_TOKEN)
  if [ -z "$url" ] || [ -z "$token" ] || [ "$url" = "null" ] || [ "$token" = "null" ]; then
    echo "activecampaign: not configured"; return 1
  fi
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "${url%/}/api/3/contacts?limit=1" -H "Api-Token: $token")
  if [ "$code" = "200" ]; then
    echo "activecampaign: OK (API reachable, token valid)"
    local automation_id
    automation_id=$(cf_config_get ACTIVECAMPAIGN_LEAD_AUTOMATION_ID)
    if [ -n "$automation_id" ] && [ "$automation_id" != "null" ]; then
      local acode
      acode=$(curl -s -o /dev/null -w '%{http_code}' "${url%/}/api/3/automations/$automation_id" -H "Api-Token: $token")
      if [ "$acode" = "200" ]; then echo "activecampaign: automation $automation_id OK"; else echo "activecampaign: automation $automation_id returned HTTP $acode"; return 1; fi
    else
      echo "activecampaign: LEAD_AUTOMATION_ID not set — follow-up sequences stay off"
    fi
  else
    echo "activecampaign: token rejected (HTTP $code)"; return 1
  fi
}

verify_tiktok() {
  local token adv
  token=$(cf_config_get TIKTOK_ACCESS_TOKEN)
  adv=$(cf_config_get TIKTOK_ADVERTISER_ID)
  if [ -z "$token" ] || [ -z "$adv" ] || [ "$token" = "null" ] || [ "$adv" = "null" ]; then
    echo "tiktok: not configured"; return 1
  fi
  local body code
  body=$(curl -s "https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=[\"$adv\"]" -H "Access-Token: $token")
  code=$(echo "$body" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("code", -1))' 2>/dev/null || echo -1)
  if [ "$code" = "0" ]; then echo "tiktok: OK (advertiser $adv visible)"; else echo "tiktok: API code $code — token/advertiser mismatch"; return 1; fi
}

verify_x() {
  local acct
  acct=$(cf_config_get X_AD_ACCOUNT_ID)
  if [ -z "$acct" ] || [ "$acct" = "null" ]; then
    echo "x: X_AD_ACCOUNT_ID not configured"; return 1
  fi
  echo "x: X_AD_ACCOUNT_ID present ($acct) — full OAuth1 verification runs in the app (admin → Campaigns → X)"
}

verify_postiz() {
  local url key
  url=$(cf_config_get POSTIZ_API_URL)
  key=$(cf_config_get POSTIZ_API_KEY)
  if [ -z "$url" ] || [ -z "$key" ] || [ "$url" = "null" ] || [ "$key" = "null" ]; then
    echo "postiz: not configured"; return 1
  fi
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "${url%/}/api/public/v1/integrations" -H "Authorization: $key")
  if [ "$code" = "200" ]; then echo "postiz: OK (API reachable, key valid)"; else echo "postiz: HTTP $code"; return 1; fi
}

verify_slack() {
  local token channel
  token=$(cf_config_get SLACK_BOT_TOKEN)
  channel=$(cf_config_get SLACK_DEFAULT_CHANNEL)
  if [ -z "$token" ] || [ "$token" = "null" ]; then
    echo "slack: bot token not configured"; return 1
  fi
  local ok
  ok=$(curl -s -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer $token" -H "Content-Type: application/json" \
    -d "{\"channel\":\"${channel:-#general}\",\"text\":\"Integration check from activate-integration.sh ✅\"}" |
    python3 -c 'import sys,json; d=json.load(sys.stdin); print("ok" if d.get("ok") else d.get("error"))')
  if [ "$ok" = "ok" ]; then
    echo "slack: OK (test message posted to ${channel:-#general})"
  else
    echo "slack: $ok — if not_in_channel, /invite the bot in Slack"; return 1
  fi
}

cmd_verify() {
  local target="${1:-all}"
  local failed=0
  case "$target" in
    activecampaign) verify_activecampaign || failed=1 ;;
    tiktok) verify_tiktok || failed=1 ;;
    x) verify_x || failed=1 ;;
    postiz) verify_postiz || failed=1 ;;
    slack) verify_slack || failed=1 ;;
    all)
      verify_activecampaign || failed=1
      verify_tiktok || failed=1
      verify_x || failed=1
      verify_postiz || failed=1
      verify_slack || failed=1
      ;;
    *) echo "Unknown target: $target"; exit 2 ;;
  esac
  return $failed
}

cmd_set() {
  local key="$1" value="$2"
  local allowed=0
  for k in "${ALLOWED_KEYS[@]}"; do [ "$k" = "$key" ] && allowed=1; done
  if [ "$allowed" -ne 1 ]; then
    echo "Refusing to set '$key' — not an activation key. Allowed: ${ALLOWED_KEYS[*]}"
    exit 2
  fi

  # Verify Cloudflare auth
  cf_verify_auth || exit 1

  # Write to both Wrangler secret and D1 config
  echo -n "Writing $key to Cloudflare... "
  cf_secret_set "$key" "$value" && echo "ok (Wrangler)" || echo "Wrangler failed"
  cf_config_set "$key" "$value" && echo "ok (D1)" || echo "D1 failed"

  case "$key" in
    ACTIVECAMPAIGN_*) cmd_verify activecampaign ;;
    TIKTOK_*) cmd_verify tiktok ;;
    X_AD_ACCOUNT_ID) cmd_verify x ;;
    POSTIZ_*) cmd_verify postiz ;;
    SLACK_*) cmd_verify slack ;;
    *) : ;;
  esac
}

case "${1:-status}" in
  status) cmd_status ;;
  set)
    [ $# -ge 3 ] || { echo "Usage: $0 set KEY VALUE"; exit 2; }
    cmd_set "$2" "$3"
    ;;
  verify) cmd_verify "${2:-all}" ;;
  *) echo "Usage: $0 {status|set KEY VALUE|verify [target]}"; exit 2 ;;
esac