#!/usr/bin/env bash
# Smoke-test a Cloudflare API token against the scopes the cloudless.gr
# infra MCP expects. Reads the token from $CLOUDFLARE_API_TOKEN if set,
# otherwise from Cloudflare secret / D1 config.
#
# Exit code: 0 if all checks pass, non-zero if any scope is missing or
# the token verify call fails outright.
#
# Run after rotating the token (see skills/cloudflare-token-doctor/SKILL.md
# Stage 3) or whenever an MCP tool unexpectedly returns "Invalid access
# token".
#
# Usage:
#   bash scripts/cf-token-smoketest.sh
#   CLOUDFLARE_API_TOKEN=... bash scripts/cf-token-smoketest.sh
#   ZONE_ID=... ACCOUNT_ID=... bash scripts/cf-token-smoketest.sh
set -uo pipefail

source "$(dirname "$0")/lib/cf-secrets.sh"

# ── Config ────────────────────────────────────────────────────────────────────
ZONE_NAME="${ZONE_NAME:-cloudless.gr}"
ZONE_ID="${ZONE_ID:-}"
ACCOUNT_ID="${ACCOUNT_ID:-}"
CF="${CLOUDFLARE_API_TOKEN:-}"

if [ -z "$CF" ]; then
  echo "→ Resolving token from Cloudflare/D1"
  CF=$(cf_config_get CLOUDFLARE_API_TOKEN)
fi
if [ -z "$CF" ] || [ "$CF" = "null" ]; then
  echo "ERR: token is empty — set CLOUDFLARE_API_TOKEN env or add to Cloudflare secrets" >&2
  exit 2
fi

API="https://api.cloudflare.com/client/v4"
PASS=0
FAIL=0

check() {
  local label="$1" status="$2"
  if [ "$status" = "ok" ]; then
    printf "  \033[32m✓\033[0m  %s\n" "$label"
    PASS=$((PASS + 1))
  else
    printf "  \033[31m✗\033[0m  %s — %s\n" "$label" "$status"
    FAIL=$((FAIL + 1))
  fi
}

curl_cf() {
  curl -sS -H "Authorization: Bearer $CF" -H "Content-Type: application/json" "$@"
}

# ── 0. Token verify ──────────────────────────────────────────────────────────
echo
echo "Cloudflare token smoke-test"
echo "---------------------------"

VERIFY="$(curl_cf "$API/user/tokens/verify")"
SUCCESS="$(echo "$VERIFY" | jq -r '.success')"
STATUS="$(echo "$VERIFY" | jq -r '.result.status // "unknown"')"

if [ "$SUCCESS" = "true" ] && [ "$STATUS" = "active" ]; then
  check "Token verify (active)" ok
else
  ERR_CODE="$(echo "$VERIFY" | jq -r '.errors[0].code // "no-code"')"
  ERR_MSG="$(echo "$VERIFY" | jq -r '.errors[0].message // "unknown"')"
  check "Token verify" "code=$ERR_CODE: $ERR_MSG"
  echo
  echo "Aborting further checks — token isn't valid."
  exit 1
fi

# ── 1. Zone:Read ─────────────────────────────────────────────────────────────
if [ -z "$ZONE_ID" ]; then
  ZR="$(curl_cf "$API/zones?name=$ZONE_NAME")"
  ZONE_ID="$(echo "$ZR" | jq -r '.result[0].id // empty')"
  if [ -n "$ZONE_ID" ]; then
    check "Zone:Read (resolved $ZONE_NAME → $ZONE_ID)" ok
  else
    ERR_MSG="$(echo "$ZR" | jq -r '.errors[0].message // "no result"')"
    check "Zone:Read" "$ERR_MSG"
  fi
else
  check "Zone:Read (zone id pre-set: $ZONE_ID)" ok
fi

# ── 2. Zone Settings:Edit (Read is implied — only Read is exercised) ─────────
if [ -n "$ZONE_ID" ]; then
  ZS="$(curl_cf "$API/zones/$ZONE_ID/settings")"
  ZS_OK="$(echo "$ZS" | jq -r '.success')"
  if [ "$ZS_OK" = "true" ]; then
    check "Zone Settings:Read" ok
  else
    ERR_MSG="$(echo "$ZS" | jq -r '.errors[0].message // "unknown"')"
    check "Zone Settings:Read" "$ERR_MSG"
  fi
fi

# ── 3. DNS:Edit (Read leg) ───────────────────────────────────────────────────
if [ -n "$ZONE_ID" ]; then
  DNS="$(curl_cf "$API/zones/$ZONE_ID/dns_records?per_page=1")"
  DNS_OK="$(echo "$DNS" | jq -r '.success')"
  if [ "$DNS_OK" = "true" ]; then
    check "DNS:Read" ok
  else
    ERR_MSG="$(echo "$DNS" | jq -r '.errors[0].message // "unknown"')"
    check "DNS:Read" "$ERR_MSG"
  fi
fi

# ── 4. Analytics:Read (GraphQL) ──────────────────────────────────────────────
# Cloudflare's httpRequests1hGroups dataset caps queries to a 3-day window.
# Use the most recent hour so the test stays well under the limit and works
# on a freshly minted token (no rolling cutover at midnight UTC).
if [ -n "$ZONE_ID" ]; then
  SINCE="$(date -u -d '1 hour ago' '+%Y-%m-%dT%H:00:00Z' 2>/dev/null || \
           date -u -v-1H '+%Y-%m-%dT%H:00:00Z')"
  GQ_BODY="$(jq -nc --arg z "$ZONE_ID" --arg s "$SINCE" '{
    query: "query($z: String!, $s: Time!) { viewer { zones(filter: {zoneTag: $z}) { httpRequests1hGroups(limit: 1, filter: {datetime_geq: $s}) { sum { requests } } } } }",
    variables: { z: $z, s: $s }
  }')"
  GQ="$(curl -sS -X POST -H "Authorization: Bearer $CF" \
    -H "Content-Type: application/json" \
    -d "$GQ_BODY" "$API/graphql")"
  GQ_ERR="$(echo "$GQ" | jq -r '.errors[0].message // empty')"
  if [ -z "$GQ_ERR" ]; then
    check "Analytics:Read (GraphQL viewer.zones)" ok
  else
    check "Analytics:Read" "$GQ_ERR"
  fi
fi

# ── 5. User API Tokens:Read ──────────────────────────────────────────────────
TL="$(curl_cf "$API/user/tokens")"
TL_OK="$(echo "$TL" | jq -r '.success')"
if [ "$TL_OK" = "true" ]; then
  TL_N="$(echo "$TL" | jq -r '.result | length')"
  check "User API Tokens:Read ($TL_N tokens visible)" ok
else
  ERR_MSG="$(echo "$TL" | jq -r '.errors[0].message // "unknown"')"
  check "User API Tokens:Read" "$ERR_MSG"
fi

# ── 6. Workers Scripts:Read (account-scoped) ─────────────────────────────────
if [ -z "$ACCOUNT_ID" ]; then
  ME="$(curl_cf "$API/accounts")"
  ACCOUNT_ID="$(echo "$ME" | jq -r '.result[0].id // empty')"
fi
if [ -n "$ACCOUNT_ID" ]; then
  WS="$(curl_cf "$API/accounts/$ACCOUNT_ID/workers/scripts")"
  WS_OK="$(echo "$WS" | jq -r '.success')"
  if [ "$WS_OK" = "true" ]; then
    WS_N="$(echo "$WS" | jq -r '.result | length')"
    check "Workers Scripts:Read ($WS_N scripts on account $ACCOUNT_ID)" ok
  else
    ERR_MSG="$(echo "$WS" | jq -r '.errors[0].message // "unknown"')"
    check "Workers Scripts:Read" "$ERR_MSG"
  fi
else
  check "Workers Scripts:Read" "could not resolve account id"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo
echo "---------------------------"
echo "Pass: $PASS  Fail: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo
  echo "→ Re-issue the token with the missing scopes. See"
  echo "   skills/cloudflare-token-doctor/SKILL.md Stage 1."
  exit 1
fi
