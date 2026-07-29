#!/usr/bin/env bash
set -euo pipefail
API=https://api.tailscale.com/api/v2
TAILNET="${TAILSCALE_TAILNET:-tail4ecae1.ts.net}"
ID="${TS_CLIENT_ID:-${TAILSCALE_OAUTH_CLIENT_ID:-}}"
SECRET="${TS_CLIENT_SECRET:-${TAILSCALE_OAUTH_CLIENT_SECRET:-${TAILSCALE_OAUTH_SECRET:-}}}"
TOK=$(curl -fsS -u "$ID:$SECRET" -d grant_type=client_credentials "$API/oauth/token" | jq -r .access_token)
AUTH="Authorization: Bearer $TOK"

echo '== nameservers =='
curl -sS -H "$AUTH" "$API/tailnet/$TAILNET/dns/nameservers" | jq . || true
echo '== preferences =='
curl -sS -H "$AUTH" "$API/tailnet/$TAILNET/dns/preferences" | jq . || true
echo '== searchpaths =='
curl -sS -H "$AUTH" "$API/tailnet/$TAILNET/dns/searchpaths" | jq . || true
echo '== ACL autoApprovers =='
curl -sS -H "$AUTH" -H 'Accept: application/json' "$API/tailnet/$TAILNET/acl" | jq '{tagOwners,autoApprovers}' || true

# Enable MagicDNS + HTTPS if prefs endpoint supports it
echo '== enable MagicDNS (POST preferences) =='
curl -sS -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$API/tailnet/$TAILNET/dns/preferences" \
  -d '{"magicDNS":true}' | jq . || true

# Some accounts use split DNS / https via keys — try legacy domain endpoint
for path in \
  "dns/preferences" \
  "keys" ; do
  echo "== GET $path =="
  curl -sS -H "$AUTH" "$API/tailnet/$TAILNET/$path" | head -c 400; echo
done
