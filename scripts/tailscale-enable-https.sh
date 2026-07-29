#!/usr/bin/env bash
# Enable MagicDNS + HTTPS Certificates via Admin API.
# Docs: PATCH /api/v2/tailnet/{tailnet}/settings  { "httpsEnabled": true }
# Client: https://github.com/tailscale/tailscale-client-go-v2/blob/main/tailnet_settings.go
set -euo pipefail
API=https://api.tailscale.com/api/v2
TAILNET="${TAILSCALE_TAILNET:-tail4ecae1.ts.net}"
ID="${TS_CLIENT_ID:-${TAILSCALE_OAUTH_CLIENT_ID:-}}"
SECRET="${TS_CLIENT_SECRET:-${TAILSCALE_OAUTH_CLIENT_SECRET:-${TAILSCALE_OAUTH_SECRET:-}}}"
TOK=$(curl -fsS -u "$ID:$SECRET" -d grant_type=client_credentials "$API/oauth/token" | jq -r .access_token)
AUTH="Authorization: Bearer $TOK"

echo '== GET settings (before) =='
curl -fsS -H "$AUTH" "$API/tailnet/$TAILNET/settings" | jq '{httpsEnabled,devicesApprovalOn,devicesAutoUpdatesOn}'

echo '== POST MagicDNS =='
curl -fsS -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$API/tailnet/$TAILNET/dns/preferences" \
  -d '{"magicDNS":true}' | jq .

echo '== PATCH httpsEnabled=true =='
HTTP=$(curl -sS -o /tmp/ts-settings-out.json -w '%{http_code}' \
  -X PATCH -H "$AUTH" -H 'Content-Type: application/json' \
  "$API/tailnet/$TAILNET/settings" \
  -d '{"httpsEnabled":true}')
echo "HTTP $HTTP"
jq . /tmp/ts-settings-out.json 2>/dev/null || cat /tmp/ts-settings-out.json
[[ "$HTTP" == "200" || "$HTTP" == "204" ]]

echo '== GET settings (after) =='
curl -fsS -H "$AUTH" "$API/tailnet/$TAILNET/settings" | jq '{httpsEnabled}'
echo '== Done =='
