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
# Idempotent: skips creation if the exact record already exists.
set -euo pipefail

DOMAIN="${DOMAIN:-cloudless.gr}"
TXT_VALUE="tiktok-developers-site-verification=30QWkDq9g0olcwcIDueeqBix84M0VCXn"
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
  if [ -n "$body" ]; then
    curl -fsS -X "$method" "$url" \
      -H "Authorization: Bearer ${CF_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "$body"
  else
    curl -fsS -X "$method" "$url" \
      -H "Authorization: Bearer ${CF_TOKEN}"
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

echo "→ Checking for existing TXT record…"
EXISTING="$(cf GET "${API}/zones/${ZONE_ID}/dns_records?type=TXT&name=${DOMAIN}&per_page=100" | \
  jq -r --arg v "$TXT_VALUE" '.result[] | select(.content == $v) | .id')"

if [ -n "$EXISTING" ]; then
  echo "✓ TXT record already exists (id=${EXISTING}) — nothing to do."
  exit 0
fi

echo "→ Creating TXT record: ${TXT_VALUE}"
RESULT="$(cf POST "${API}/zones/${ZONE_ID}/dns_records" \
  "{\"type\":\"TXT\",\"name\":\"${DOMAIN}\",\"content\":\"${TXT_VALUE}\",\"ttl\":300}")"

if echo "$RESULT" | jq -e '.success == true' > /dev/null; then
  RECORD_ID="$(echo "$RESULT" | jq -r '.result.id')"
  echo "✓ TXT record created (id=${RECORD_ID})"
else
  echo "::error::failed to create DNS record: $(echo "$RESULT" | jq -c .)"
  exit 1
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
