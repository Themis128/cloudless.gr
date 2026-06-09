#!/usr/bin/env bash
#
# Disable Cloudflare "Email Obfuscation" (Scrape Shield) on the cloudless.gr
# zone.
#
# WHY: Email Obfuscation rewrites email addresses in the HTML at the Cloudflare
# edge — AFTER Next.js SSR — turning `contact@cloudless.gr` into an obfuscated
# `<a class="__cf_email__" data-cfemail="...">` placeholder plus an injected
# `/cdn-cgi/.../email-decode.min.js`. React then hydrates the SSR markup (plain
# email) against the edge-rewritten DOM → text mismatch → React error #418 on
# /en. The strict CSP also blocks the injected decode script. Turning the
# feature off makes the edge HTML byte-identical to the SSR HTML again.
#
# Auth: CLOUDFLARE_API_TOKEN env, else SSM /cloudless/production/CLOUDFLARE_API_TOKEN.
# The token needs Zone:Read + Zone Settings:Edit on zone cloudless.gr.
#
# Idempotent: if the setting is already "off" it reports success and changes
# nothing. Safe to re-run.
set -euo pipefail

DOMAIN="${DOMAIN:-cloudless.gr}"
API="https://api.cloudflare.com/client/v4"

CF_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
if [ -z "$CF_TOKEN" ]; then
  CF_TOKEN="$(aws ssm get-parameter --name /cloudless/production/CLOUDFLARE_API_TOKEN \
    --with-decryption --query Parameter.Value --output text 2>/dev/null || true)"
fi
if [ -z "$CF_TOKEN" ]; then
  echo "::error::no CLOUDFLARE_API_TOKEN — add a repo secret (or SSM /cloudless/production/CLOUDFLARE_API_TOKEN) with Zone:Read + Zone Settings:Edit on ${DOMAIN}."
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
      -H "Authorization: Bearer ${CF_TOKEN}" \
      -H "Content-Type: application/json"
  fi
}

ok() { echo "$1" | grep -q '"success":true'; }

echo "==> resolving zone for ${DOMAIN}"
ZRESP="$(cf GET "${API}/zones?name=${DOMAIN}")"
ok "$ZRESP" || { echo "$ZRESP"; echo "::error::zone lookup failed (token missing Zone:Read?)"; exit 1; }
ZONE_ID="$(echo "$ZRESP" | grep -o '"id":"[0-9a-f]\{32\}"' | head -1 | cut -d'"' -f4)"
[ -n "$ZONE_ID" ] || { echo "::error::could not resolve zone id for ${DOMAIN}"; exit 1; }
echo "    zone: ${ZONE_ID}"

echo "==> current email_obfuscation setting"
CUR="$(cf GET "${API}/zones/${ZONE_ID}/settings/email_obfuscation")" || true
CUR_VAL="$(echo "$CUR" | grep -o '"value":"[a-z]*"' | head -1 | cut -d'"' -f4)"
echo "    value: ${CUR_VAL:-unknown}"

if [ "$CUR_VAL" = "off" ]; then
  echo "==> already off — nothing to do"
  exit 0
fi

echo "==> disabling email_obfuscation"
RESP="$(cf PATCH "${API}/zones/${ZONE_ID}/settings/email_obfuscation" '{"value":"off"}')" || {
  echo "$RESP"
  echo "::error::PATCH failed — token likely missing 'Zone Settings: Edit' scope. Add it to the Cloudflare token (Zone → Zone Settings → Edit, zone ${DOMAIN})."
  exit 1
}
ok "$RESP" || { echo "$RESP"; echo "::error::Cloudflare reported failure disabling email_obfuscation"; exit 1; }

NEW_VAL="$(echo "$RESP" | grep -o '"value":"[a-z]*"' | head -1 | cut -d'"' -f4)"
echo "==> email_obfuscation is now: ${NEW_VAL}"
[ "$NEW_VAL" = "off" ] || { echo "::error::expected off, got ${NEW_VAL}"; exit 1; }
echo "==> done. The __cf_email__ rewrite that caused React #418 on /en is disabled."
