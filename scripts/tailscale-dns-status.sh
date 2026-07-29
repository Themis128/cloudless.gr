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

echo '== enable MagicDNS (POST preferences) =='
curl -sS -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$API/tailnet/$TAILNET/dns/preferences" \
  -d '{"magicDNS":true}' | jq . || true

echo '== GET /settings (httpsEnabled) =='
curl -sS -H "$AUTH" "$API/tailnet/$TAILNET/settings" | jq '{httpsEnabled}' || true

# Official: PATCH /tailnet/{tailnet}/settings  { "httpsEnabled": true }
# https://github.com/tailscale/tailscale-client-go-v2/blob/main/tailnet_settings.go
if [[ "${ENABLE_HTTPS:-0}" =~ ^(1|true|TRUE|yes|YES)$ ]]; then
  echo '== PATCH httpsEnabled=true =='
  curl -sS -X PATCH -H "$AUTH" -H 'Content-Type: application/json' \
    "$API/tailnet/$TAILNET/settings" \
    -d '{"httpsEnabled":true}' | jq . || true
  curl -sS -H "$AUTH" "$API/tailnet/$TAILNET/settings" | jq '{httpsEnabled}' || true
fi
