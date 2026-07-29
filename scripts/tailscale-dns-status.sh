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

# Enable MagicDNS (HTTPS Certificates are admin-UI only — no public API).
echo '== enable MagicDNS (POST preferences) =='
curl -sS -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  "$API/tailnet/$TAILNET/dns/preferences" \
  -d '{"magicDNS":true}' | jq . || true

echo '== GET dns/preferences =='
curl -sS -H "$AUTH" "$API/tailnet/$TAILNET/dns/preferences" | jq . || true

# Probe undocumented / alpha endpoints for HTTPS toggle (expect 404/405).
for path in \
  "dns/configuration" \
  "dns/https" \
  "settings" ; do
  echo "== PROBE GET $path =="
  code=$(curl -sS -o /tmp/ts-probe.json -w '%{http_code}' -H "$AUTH" "$API/tailnet/$TAILNET/$path" || true)
  echo "HTTP $code $(head -c 200 /tmp/ts-probe.json 2>/dev/null)"
done

echo '== HTTPS Certificates =='
echo 'No public API. Enable in admin console:'
echo '  https://login.tailscale.com/admin/dns  →  HTTPS Certificates → Enable HTTPS'
echo 'Then delete empty TLS Secrets so the operator re-provisions:'
echo '  kubectl -n tailscale delete secret grafana.tail4ecae1.ts.net kube.tail4ecae1.ts.net meilisearch.tail4ecae1.ts.net'
