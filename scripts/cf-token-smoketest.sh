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
WARN=0

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

warn() {
  local label="$1" status="$2"
  printf "  \033[33m!\033[0m  %s — %s\n" "$label" "$status"
  WARN=$((WARN + 1))
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

# ── 3. DNS:Read/Edit ─────────────────────────────────────────────────────────
if [ -n "$ZONE_ID" ]; then
  DNS="$(curl_cf "$API/zones/$ZONE_ID/dns_records?per_page=1")"
  DNS_OK="$(echo "$DNS" | jq -r '.success')"
  if [ "$DNS_OK" = "true" ]; then
    check "DNS:Read" ok
  else
    ERR_MSG="$(echo "$DNS" | jq -r '.errors[0].message // "unknown"')"
    check "DNS:Read" "$ERR_MSG"
  fi

  # Probe DNS:Edit by creating and immediately deleting a test TXT record.
  TEST_RECORD="tiktok-developers-site-verification=cf-smoketest-$(date +%s)"
  DNS_CREATE="$(curl_cf -X POST -d "{\"type\":\"TXT\",\"name\":\"_cf-smoketest.${ZONE_NAME}\",\"content\":\"${TEST_RECORD}\",\"ttl\":60,\"comment\":\"smoketest\"}" "$API/zones/$ZONE_ID/dns_records")"
  DNS_CREATE_OK="$(echo "$DNS_CREATE" | jq -r '.success')"
  DNS_CREATE_ID="$(echo "$DNS_CREATE" | jq -r '.result.id // empty')"
  if [ "$DNS_CREATE_OK" = "true" ] && [ -n "$DNS_CREATE_ID" ]; then
    DNS_DELETE="$(curl_cf -X DELETE "$API/zones/$ZONE_ID/dns_records/$DNS_CREATE_ID")"
    DNS_DELETE_OK="$(echo "$DNS_DELETE" | jq -r '.success')"
    if [ "$DNS_DELETE_OK" = "true" ]; then
      check "DNS:Edit" ok
    else
      ERR_MSG="$(echo "$DNS_DELETE" | jq -r '.errors[0].message // "unknown"')"
      check "DNS:Edit (cleanup failed)" "$ERR_MSG"
    fi
  else
    ERR_CODE="$(echo "$DNS_CREATE" | jq -r '.errors[0].code // "unknown"')"
    ERR_MSG="$(echo "$DNS_CREATE" | jq -r '.errors[0].message // "unknown"')"
    check "DNS:Edit" "code=$ERR_CODE: $ERR_MSG"
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

# ── 5. User API Tokens:Read (optional — needed only to inspect policies) ─────
TL="$(curl_cf "$API/user/tokens")"
TL_OK="$(echo "$TL" | jq -r '.success')"
if [ "$TL_OK" = "true" ]; then
  TL_N="$(echo "$TL" | jq -r '.result | length')"
  check "User API Tokens:Read ($TL_N tokens visible)" ok
else
  ERR_MSG="$(echo "$TL" | jq -r '.errors[0].message // "unknown"')"
  warn "User API Tokens:Read" "$ERR_MSG (optional; add API Tokens Read to inspect Workers Write)"
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

# ── 7. Workers Scripts:Write (required for cloudless2 wrangler deploy) ───────
# Prefer policy inspection; else probe versions create (expect 400 validation
# if Write is allowed, 401/403/10000 if not).
WORKERS_WRITE_ID="e086da7e2179491d91ee5f35b3ca210a"
if [ "$TL_OK" = "true" ]; then
  HAS_WS_WRITE="$(echo "$TL" | jq -r --arg pid "$WORKERS_WRITE_ID" '
    [.result[]?
      | select(.status == "active")
      | .policies[]?.permission_groups[]?
      | select(.id == $pid)
    ] | length
  ')"
  if [ "$HAS_WS_WRITE" != "0" ] && [ -n "$HAS_WS_WRITE" ]; then
    check "Workers Scripts:Write (present on an active user token policy)" ok
  else
    check "Workers Scripts:Write" "not found on active token policies — cloudflare-deploy.yml will 10000"
  fi
elif [ -n "$ACCOUNT_ID" ]; then
  PROBE="$(curl -sS -o /tmp/cf-ws-write-probe.json -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $CF" -H "Content-Type: application/json" \
    -d '{}' \
    "$API/accounts/$ACCOUNT_ID/workers/scripts/cloudless2/versions" || echo "000")"
  PROBE_BODY="$(cat /tmp/cf-ws-write-probe.json 2>/dev/null || true)"
  PROBE_ERR="$(echo "$PROBE_BODY" | jq -r '.errors[0].code // empty' 2>/dev/null || true)"
  # 415 = endpoint expects multipart/form-data — reached validation, so auth OK.
  if [ "$PROBE" = "400" ] || [ "$PROBE" = "422" ] || [ "$PROBE" = "415" ]; then
    check "Workers Scripts:Write (versions create rejected as validation — auth OK)" ok
  elif [ "$PROBE" = "401" ] || [ "$PROBE" = "403" ] || [ "$PROBE_ERR" = "10000" ] || [ "$PROBE_ERR" = "1001" ]; then
    check "Workers Scripts:Write" "HTTP $PROBE code=${PROBE_ERR:-?} — add Workers Scripts Write for cloudless2 deploy"
  else
    warn "Workers Scripts:Write" "unexpected HTTP $PROBE — see cloudflare-workers-deploy skill"
  fi
else
  warn "Workers Scripts:Write" "skipped (no account id)"
fi

# ── 8. D1:Read (migrations need Write; list proves D1 access) ────────────────
if [ -n "$ACCOUNT_ID" ]; then
  D1="$(curl_cf "$API/accounts/$ACCOUNT_ID/d1/database")"
  D1_OK="$(echo "$D1" | jq -r '.success')"
  if [ "$D1_OK" = "true" ]; then
    D1_N="$(echo "$D1" | jq -r '.result | length')"
    check "D1:Read ($D1_N databases)" ok
  else
    ERR_MSG="$(echo "$D1" | jq -r '.errors[0].message // "unknown"')"
    check "D1:Read" "$ERR_MSG"
  fi
fi

# ── 9. Cloudflare Tunnel:Read (optional — soft-skipped in CI if missing) ─────
TUNNEL_ID="${CLUSTER_CLOUDFLARED_TUNNEL_ID:-e977a490-58c5-4fdb-9155-86832e3e636a}"
if [ -n "$ACCOUNT_ID" ]; then
  TN="$(curl_cf "$API/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations")"
  TN_OK="$(echo "$TN" | jq -r '.success')"
  if [ "$TN_OK" = "true" ]; then
    check "Cloudflare Tunnel:Read (config)" ok
  else
    ERR_CODE="$(echo "$TN" | jq -r '.errors[0].code // "unknown"')"
    ERR_MSG="$(echo "$TN" | jq -r '.errors[0].message // "unknown"')"
    warn "Cloudflare Tunnel:Read" "code=$ERR_CODE: $ERR_MSG (CI soft-skips; set CLOUDFLARE_TUNNEL_API_TOKEN or Tunnel Write)"
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo
echo "---------------------------"
echo "Pass: $PASS  Fail: $FAIL  Warn: $WARN"

if [ "$FAIL" -gt 0 ]; then
  echo
  echo "→ Re-issue / ensure-ci the token with the missing scopes. See"
  echo "   skills/cloudflare-token-doctor/SKILL.md and"
  echo "   .claude/skills/cloudflare-workers-deploy/SKILL.md"
  echo "   bash scripts/cf-token-permissions.sh ensure-ci \"<token-name>\""
  exit 1
fi

if [ "$WARN" -gt 0 ]; then
  echo
  echo "→ Warnings only — CI may still soft-skip tunnel/proxy deploy. Fix when convenient."
fi
