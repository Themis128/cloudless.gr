#!/usr/bin/env bash
# Add TikTok site-verification DNS TXT record to the cloudless.gr zone.
#
# TikTok's verification bot checks for either:
#   <meta name="tiktok-developers-site-verification" content="TOKEN">
#   OR a DNS TXT record: tiktok-developers-site-verification=TOKEN
#
# We use the TXT record because Cloudflare Bot Management may challenge TikTok's
# HTTP crawler before it can read the meta tag.
#
# Auth: CLOUDFLARE_API_TOKEN env, else SSM /cloudless/production/CLOUDFLARE_API_TOKEN.
# Token needs Zone:Read + Zone:DNS:Edit on cloudless.gr.
# Idempotent: if a TikTok verification TXT record already exists with the exact
# same value, skips. If a TikTok verification TXT record exists with a DIFFERENT
# value (token rotation), updates it in-place via PUT. Otherwise creates a new one.
set -euo pipefail

DOMAIN="${DOMAIN:-cloudless.gr}"
TIKTOK_VERIFICATION_TOKEN="${TIKTOK_VERIFICATION_TOKEN:-}"
if [ -z "$TIKTOK_VERIFICATION_TOKEN" ]; then
  echo "::error::TIKTOK_VERIFICATION_TOKEN is required."
  exit 1
fi
TXT_VALUE="tiktok-developers-site-verification=${TIKTOK_VERIFICATION_TOKEN}"
API="https://api.cloudflare.com/client/v4"

CF_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
if [ -z "$CF_TOKEN" ]; then
  CF_TOKEN="$(aws ssm get-parameter --name /cloudless/production/CLOUDFLARE_API_TOKEN \
    --with-decryption --query Parameter.Value --output text 2>/dev/null || true)"
fi
if [ -z "$CF_TOKEN" ]; then
  echo "::error::no CLOUDFLARE_API_TOKEN — add a repo secret or SSM /cloudless/production/CLOUDFLARE_API_TOKEN with Zone:Read + Zone:DNS:Edit."
  exit 1
fi

cf() {
  local method="$1" url="$2" body="${3:-}"
  local http_code out
  out=$(mktemp)
  if [ -n "$body" ]; then
    http_code=$(curl -sS -o "$out" -w '%{http_code}' -X "$method" "$url" \
      -H "Authorization: Bearer ${CF_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "$body")
  else
    http_code=$(curl -sS -o "$out" -w '%{http_code}' -X "$method" "$url" \
      -H "Authorization: Bearer ${CF_TOKEN}")
  fi
  cat "$out"
  rm -f "$out"
  if [ "$http_code" -ge 400 ]; then
    return "$http_code"
  fi
}

echo "→ Looking up zone ID for ${DOMAIN}…"
ZONE_ID="$(cf GET "${API}/zones?name=${DOMAIN}&status=active" | \
  jq -r '.result[0].id // empty')"
if [ -z "$ZONE_ID" ]; then
  echo "::error::zone not found for ${DOMAIN} — check token permissions."
  exit 1
fi
echo "  zone_id=${ZONE_ID}"

echo "→ Checking for existing TikTok verification TXT record…"
# Match any TXT record whose content starts with the TikTok verification prefix,
# regardless of the token value (so token rotations are detected).
RECORDS_JSON="$(cf GET "${API}/zones/${ZONE_ID}/dns_records?type=TXT&name=${DOMAIN}&per_page=100")"

# Exact match — same token, nothing to do.
EXISTING_EXACT="$(echo "$RECORDS_JSON" | \
  jq -r --arg v "$TXT_VALUE" '.result[] | select(.content == $v) | .id')"
if [ -n "$EXISTING_EXACT" ]; then
  echo "✓ TXT record already exists with this token (id=${EXISTING_EXACT}) — nothing to do."
  exit 0
fi

# Prefix match — old token, needs updating.
EXISTING_OLD_ID="$(echo "$RECORDS_JSON" | \
  jq -r --arg prefix "tiktok-developers-site-verification=" \
  '.result[] | select(.content | startswith($prefix)) | .id')"
EXISTING_OLD_CONTENT="$(echo "$RECORDS_JSON" | \
  jq -r --arg prefix "tiktok-developers-site-verification=" \
  '.result[] | select(.content | startswith($prefix)) | .content')"

if [ -n "$EXISTING_OLD_ID" ]; then
  echo "→ Found existing TikTok verification record with different token (id=${EXISTING_OLD_ID})"
  echo "  old value: ${EXISTING_OLD_CONTENT}"
  echo "  new value: ${TXT_VALUE}"
  echo "→ Updating TXT record…"
  if ! RESULT="$(cf PUT "${API}/zones/${ZONE_ID}/dns_records/${EXISTING_OLD_ID}" \
    "{\"type\":\"TXT\",\"name\":\"${DOMAIN}\",\"content\":\"${TXT_VALUE}\",\"ttl\":300}")"; then
    echo "::error::failed to update DNS record: $(echo "$RESULT" | jq -c . 2>/dev/null || echo "$RESULT")"
    exit 1
  fi
  if echo "$RESULT" | jq -e '.success == true' > /dev/null; then
    echo "✓ TXT record updated (id=${EXISTING_OLD_ID})"
  else
    echo "::error::failed to update DNS record: $(echo "$RESULT" | jq -c .)"
    exit 1
  fi
else
  echo "→ No existing TikTok verification TXT record found — creating new one."
  echo "→ Creating TXT record: ${TXT_VALUE}"
  if ! RESULT="$(cf POST "${API}/zones/${ZONE_ID}/dns_records" \
    "{\"type\":\"TXT\",\"name\":\"${DOMAIN}\",\"content\":\"${TXT_VALUE}\",\"ttl\":300}")"; then
    echo "::error::failed to create DNS record: $(echo "$RESULT" | jq -c . 2>/dev/null || echo "$RESULT")"
    exit 1
  fi

  if echo "$RESULT" | jq -e '.success == true' > /dev/null; then
    RECORD_ID="$(echo "$RESULT" | jq -r '.result.id')"
    echo "✓ TXT record created (id=${RECORD_ID})"
  else
    echo "::error::failed to create DNS record: $(echo "$RESULT" | jq -c .)"
    exit 1
  fi
fi

echo "→ Verifying record is live (may take up to 60s)…"
for i in $(seq 1 12); do
  txt="$(dig +short TXT "${DOMAIN}" @1.1.1.1 2>/dev/null | grep -F "$TXT_VALUE" || true)"
  if [ -n "$txt" ]; then
    echo "✓ TXT record visible via 1.1.1.1 (attempt ${i})"
    exit 0
  fi
  echo "  … not visible yet (attempt ${i}), waiting 5s…"
  sleep 5
done
echo "::warning::record created but not yet visible via DNS — may take a few more seconds to propagate."
