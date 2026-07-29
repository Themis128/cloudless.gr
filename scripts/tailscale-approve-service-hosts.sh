#!/usr/bin/env bash
# Approve Tailscale Service hosts for k8s ProxyGroup fabric.
# API: GET/POST /api/v2/tailnet/{tailnet}/services/{svc}/device/{nodeId}/approved
set -euo pipefail
API=https://api.tailscale.com/api/v2
TAILNET="${TAILSCALE_TAILNET:-tail4ecae1.ts.net}"
ID="${TS_CLIENT_ID:-${TAILSCALE_OAUTH_CLIENT_ID:-}}"
SECRET="${TS_CLIENT_SECRET:-${TAILSCALE_OAUTH_CLIENT_SECRET:-${TAILSCALE_OAUTH_SECRET:-}}}"
TOK=$(curl -fsS -u "$ID:$SECRET" -d grant_type=client_credentials "$API/oauth/token" | jq -r .access_token)
AUTH="Authorization: Bearer $TOK"

SVCS=(svc:grafana svc:meilisearch svc:kube)

echo '== List services =='
curl -fsS -H "$AUTH" "$API/tailnet/$TAILNET/services" | jq '.vipServices[] | {name,addrs,ports,tags}'

for svc in "${SVCS[@]}"; do
  echo "== $svc devices =="
  enc=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$svc")
  # URL path uses literal svc:name — try both encoded and raw
  for path in \
    "$API/tailnet/$TAILNET/services/$svc/devices" \
    "$API/tailnet/$TAILNET/services/$enc/devices"; do
    code=$(curl -sS -o /tmp/hosts.json -w '%{http_code}' -H "$AUTH" "$path" || true)
    echo "GET $path -> $code"
    [[ "$code" == "200" ]] && break
  done
  jq . /tmp/hosts.json 2>/dev/null || cat /tmp/hosts.json; echo

  # Approve each host
  jq -r '.hosts[]?.nodeId // .devices[]?.nodeId // empty' /tmp/hosts.json 2>/dev/null | while read -r nid; do
    [[ -z "$nid" ]] && continue
    echo "Approve $svc on nodeId=$nid"
    for base in \
      "$API/tailnet/$TAILNET/services/$svc/device/$nid/approved" \
      "$API/tailnet/$TAILNET/services/$enc/device/$nid/approved"; do
      code=$(curl -sS -o /tmp/appr.json -w '%{http_code}' -X POST -H "$AUTH" \
        -H 'Content-Type: application/json' \
        -d '{"approved":true}' "$base" || true)
      echo "POST $base -> $code $(cat /tmp/appr.json)"
      [[ "$code" == "200" ]] && break
    done
  done
done

echo '== Done =='
