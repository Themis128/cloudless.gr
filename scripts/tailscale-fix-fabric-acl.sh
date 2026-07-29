#!/usr/bin/env bash
# Fix fabric ACL tagOwners + approve Connector subnet routes.
set -euo pipefail
API=https://api.tailscale.com/api/v2
TAILNET="${TAILSCALE_TAILNET:-tail4ecae1.ts.net}"
ID="${TS_CLIENT_ID:-${TAILSCALE_OAUTH_CLIENT_ID:-}}"
SECRET="${TS_CLIENT_SECRET:-${TAILSCALE_OAUTH_CLIENT_SECRET:-${TAILSCALE_OAUTH_SECRET:-}}}"
TOK=$(curl -fsS -u "$ID:$SECRET" -d grant_type=client_credentials "$API/oauth/token" | jq -r .access_token)
AUTH="Authorization: Bearer $TOK"

echo '== GET ACL =='
ACL=$(mktemp)
HDR=$(mktemp)
curl -fsS -D "$HDR" -o "$ACL" -H "$AUTH" -H 'Accept: application/json' "$API/tailnet/$TAILNET/acl"
ETAG=$(awk -F': ' 'BEGIN{IGNORECASE=1} /^etag:/{gsub(/\r/,"",$2); print $2; exit}' "$HDR")
echo "ETag=$ETAG"
jq '{tagOwners,autoApprovers}' "$ACL"

echo '== Fix tagOwners =='
FIXED=$(mktemp)
python3 - "$ACL" "$FIXED" <<'PY'
import json,sys
cur=json.load(open(sys.argv[1]))
owners=cur.setdefault('tagOwners',{})
# Ensure operator tag is owned by admins; k8s owned by operator
owners['tag:k8s-operator']=list(dict.fromkeys((owners.get('tag:k8s-operator') or []) + ['autogroup:admin']))
owners['tag:k8s']=list(dict.fromkeys((owners.get('tag:k8s') or []) + ['tag:k8s-operator']))
aa=cur.setdefault('autoApprovers',{})
routes=aa.setdefault('routes',{})
for cidr in ('10.42.0.0/16','10.43.0.0/16'):
    routes[cidr]=list(dict.fromkeys((routes.get(cidr) or []) + ['tag:k8s']))
svcs=aa.setdefault('services',{})
svcs['svc:*']=list(dict.fromkeys((svcs.get('svc:*') or []) + ['tag:k8s']))
json.dump(cur, open(sys.argv[2],'w'), indent=2)
print('tagOwners', owners)
print('autoApprovers', aa)
PY

ARGS=(-H "$AUTH" -H 'Content-Type: application/json' -H 'Accept: application/json')
[[ -n "$ETAG" ]] && ARGS+=(-H "If-Match: $ETAG")
HTTP=$(curl -sS -o /tmp/acl-out.json -w '%{http_code}' "${ARGS[@]}" --data-binary @"$FIXED" "$API/tailnet/$TAILNET/acl")
echo "POST ACL HTTP $HTTP"
jq '{tagOwners,autoApprovers}' /tmp/acl-out.json 2>/dev/null || head -c 400 /tmp/acl-out.json; echo
[[ "$HTTP" == "200" ]]

echo '== Approve subnet routes on k3s-subnet-router-* =='
DEVS=$(curl -fsS -H "$AUTH" "$API/tailnet/$TAILNET/devices")
echo "$DEVS" | jq -r '.devices[] | select((.hostname|split(".")[0]|test("k3s-subnet-router"))) | [.id,.hostname,.enabledRoutes,.advertisedRoutes] | @tsv'
echo "$DEVS" | jq -c '.devices[] | select((.hostname|split(".")[0]|test("k3s-subnet-router")))' | while read -r row; do
  DID=$(echo "$row" | jq -r .id)
  HOST=$(echo "$row" | jq -r .hostname)
  echo "Approving routes on $HOST ($DID)"
  curl -sS -X POST -H "$AUTH" -H 'Content-Type: application/json' \
    "$API/device/$DID/routes" \
    -d '{"routes":["10.42.0.0/16","10.43.0.0/16"]}' | jq .
done

echo '== Done =='
