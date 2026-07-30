#!/usr/bin/env bash
# Sync Tailscale Services console with the k3s fabric:
#   1) Approve all advertised hosts for every svc:*
#   2) Delete orphan VIP Services no longer backed by cluster Ingress/ProxyGroup
#
# Expected (operator-managed):
#   svc:grafana, svc:meilisearch  — Ingress + ProxyGroup/ingress
#   svc:kube                      — ProxyGroup/kube-apiserver
#
# API: https://tailscale.com/docs/features/tailscale-services
#      https://tailscale.com/docs/reference/api
set -euo pipefail
API=https://api.tailscale.com/api/v2
TAILNET="${TAILSCALE_TAILNET:-tail4ecae1.ts.net}"
ID="${TS_CLIENT_ID:-${TAILSCALE_OAUTH_CLIENT_ID:-}}"
SECRET="${TS_CLIENT_SECRET:-${TAILSCALE_OAUTH_CLIENT_SECRET:-${TAILSCALE_OAUTH_SECRET:-}}}"
TOK=$(curl -fsS -u "$ID:$SECRET" -d grant_type=client_credentials "$API/oauth/token" | jq -r .access_token)
AUTH="Authorization: Bearer $TOK"
DRY_RUN="${DRY_RUN:-0}"
case "${DRY_RUN}" in
  1|true|TRUE|yes|YES) DRY_RUN=1 ;;
  *) DRY_RUN=0 ;;
esac

# Canonical fabric services — everything else tagged tag:k8s is treated as orphan.
EXPECTED='svc:grafana svc:meilisearch svc:kube'

urlenc() {
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
}

echo "== List VIP Services =="
SVCS_JSON=$(mktemp)
curl -fsS -H "$AUTH" "$API/tailnet/$TAILNET/services" >"$SVCS_JSON"
jq -r '.vipServices[] | "\(.name)\t\(.addrs|join(","))\t\(.ports|join(","))\t\((.tags // [])|join(","))"' "$SVCS_JSON"

echo
echo "== Approve hosts for every service =="
jq -r '.vipServices[].name' "$SVCS_JSON" | while read -r svc; do
  [[ -z "$svc" ]] && continue
  enc=$(urlenc "$svc")
  code=$(curl -sS -o /tmp/hosts.json -w '%{http_code}' -H "$AUTH" \
    "$API/tailnet/$TAILNET/services/$enc/devices" || true)
  echo "-- $svc devices HTTP $code"
  [[ "$code" == "200" ]] || continue
  jq -c '.hosts[]?' /tmp/hosts.json 2>/dev/null | while read -r host; do
    nid=$(echo "$host" | jq -r .nodeId)
    level=$(echo "$host" | jq -r .approvalLevel)
    cfg=$(echo "$host" | jq -r .configured)
    echo "   host $nid approval=$level configured=$cfg"
    if [[ "$DRY_RUN" == "1" ]]; then
      echo "   DRY_RUN skip approve"
      continue
    fi
    acode=$(curl -sS -o /tmp/appr.json -w '%{http_code}' -X POST -H "$AUTH" \
      -H 'Content-Type: application/json' \
      -d '{"approved":true}' \
      "$API/tailnet/$TAILNET/services/$enc/device/$nid/approved" || true)
    echo "   POST approved -> $acode $(cat /tmp/appr.json)"
  done
done

echo
echo "== Delete orphan services (not in: $EXPECTED) =="
jq -r '.vipServices[].name' "$SVCS_JSON" | while read -r svc; do
  [[ -z "$svc" ]] && continue
  if echo " $EXPECTED " | grep -q " $svc "; then
    echo "KEEP  $svc"
    continue
  fi
  enc=$(urlenc "$svc")
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "ORPHAN $svc (would DELETE)"
    continue
  fi
  dcode=$(curl -sS -o /tmp/del.json -w '%{http_code}' -X DELETE -H "$AUTH" \
    "$API/tailnet/$TAILNET/services/$enc" || true)
  echo "DELETE $svc -> $dcode $(head -c 200 /tmp/del.json 2>/dev/null | tr '\n' ' ')"
done

echo
echo "== Final service list =="
curl -fsS -H "$AUTH" "$API/tailnet/$TAILNET/services" \
  | jq -r '.vipServices[] | .name'
echo "== Done =="
rm -f "$SVCS_JSON"
