#!/usr/bin/env bash
set -euo pipefail
API=https://api.tailscale.com/api/v2
TAILNET=tail4ecae1.ts.net
ID="${TS_CLIENT_ID:-$TAILSCALE_OAUTH_CLIENT_ID}"
SECRET="${TS_CLIENT_SECRET:-${TAILSCALE_OAUTH_CLIENT_SECRET:-$TAILSCALE_OAUTH_SECRET}}"
TOK=$(curl -fsS -u "$ID:$SECRET" -d grant_type=client_credentials "$API/oauth/token" | jq -r .access_token)
AUTH="Authorization: Bearer $TOK"
echo '== DNS prefs =='
curl -fsS -H "$AUTH" "$API/tailnet/$TAILNET/dns" | jq .
echo '== ACL autoApprovers snippet =='
curl -fsS -H "$AUTH" -H 'Accept: application/json' "$API/tailnet/$TAILNET/acl" | jq '{tagOwners,autoApprovers,grants:(.grants|length)}'
# Try enable HTTPS if endpoint exists
echo '== attempt enable https certs (POST domain) =='
# Tailscale uses MagicDNS domain; HTTPS enable is often via console. Check domain status:
curl -sS -H "$AUTH" "$API/tailnet/$TAILNET/dns/namservers" | head -c 500; echo
curl -sS -H "$AUTH" "$API/tailnet/$TAILNET/domain" 2>&1 | head -c 500; echo
