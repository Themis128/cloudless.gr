#!/usr/bin/env bash
set -euo pipefail
API=https://api.tailscale.com/api/v2
TAILNET="${TAILSCALE_TAILNET:-tail4ecae1.ts.net}"
ID="${TS_CLIENT_ID:-${TAILSCALE_OAUTH_CLIENT_ID:-}}"
SECRET="${TS_CLIENT_SECRET:-${TAILSCALE_OAUTH_CLIENT_SECRET:-${TAILSCALE_OAUTH_SECRET:-}}}"
TOK=$(curl -fsS -u "$ID:$SECRET" -d grant_type=client_credentials "$API/oauth/token" | jq -r .access_token)
AUTH="Authorization: Bearer $TOK"

echo '== ACL autoApprovers.services =='
curl -fsS -H "$AUTH" -H 'Accept: application/json' "$API/tailnet/$TAILNET/acl" | jq '.autoApprovers.services'

echo '== probe service endpoints =='
for path in \
  "tailnet/$TAILNET/services" \
  "tailnet/$TAILNET/vip-services" \
  "tailnet/-/services" \
  "tailnet/-/vip-services" ; do
  code=$(curl -sS -o /tmp/ts.json -w '%{http_code}' -H "$AUTH" -H 'Accept: application/json' "$API/$path" || true)
  echo "GET $path -> $code $(head -c 300 /tmp/ts.json | tr '\n' ' ')"
  echo
done

# Per-device: look for any service-related fields
echo '== ingress-0 / kube-0 device JSON keys =='
curl -fsS -H "$AUTH" "$API/tailnet/$TAILNET/devices" | jq -r '
  .devices[] | select(.hostname|test("ingress-0|kube-0")) | .id+" "+.hostname' | while read -r id host; do
  echo "-- $host $id"
  curl -fsS -H "$AUTH" "$API/device/$id" | jq 'keys'
  curl -fsS -H "$AUTH" "$API/device/$id" | jq '{hostname,tags,addresses,clientConnectivity,advertisedRoutes,enabledRoutes,blocksIncomingConnections}'
  for sub in routes services vip-services approved-routes; do
    code=$(curl -sS -o /tmp/d.json -w '%{http_code}' -H "$AUTH" "$API/device/$id/$sub" || true)
    echo "  GET device/$id/$sub -> $code $(head -c 200 /tmp/d.json | tr '\n' ' ')"
    echo
  done
done
