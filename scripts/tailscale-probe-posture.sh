#!/usr/bin/env bash
set -euo pipefail
API=https://api.tailscale.com/api/v2
TAILNET="${TAILSCALE_TAILNET:-tail4ecae1.ts.net}"
ID="${TS_CLIENT_ID:-${TAILSCALE_OAUTH_CLIENT_ID:-}}"
SECRET="${TS_CLIENT_SECRET:-${TAILSCALE_OAUTH_CLIENT_SECRET:-${TAILSCALE_OAUTH_SECRET:-}}}"
TOK=$(curl -fsS -u "$ID:$SECRET" -d grant_type=client_credentials "$API/oauth/token" | jq -r .access_token)
AUTH="Authorization: Bearer $TOK"

echo '== settings =='
curl -fsS -H "$AUTH" "$API/tailnet/$TAILNET/settings" | jq .

ACL=$(mktemp); HDR=$(mktemp)
curl -fsS -D "$HDR" -o "$ACL" -H "$AUTH" -H 'Accept: application/json' "$API/tailnet/$TAILNET/acl"
echo '== nodeAttrs / postures / ssh (keys) =='
jq 'keys' "$ACL"
echo '== nodeAttrs =='
jq '.nodeAttrs // empty' "$ACL"
echo '== postures =='
jq '.postures // empty' "$ACL"
echo '== raw grep attestation =='
grep -n -i 'attest\|posture\|tpm\|hardware' "$ACL" || true

echo '== tagged devices =='
curl -fsS -H "$AUTH" "$API/tailnet/$TAILNET/devices" | jq -r '
  .devices[]
  | select((.hostname|test("kube-0|ingress-0|operator|subnet-router|github-omv|omv-ha|office")))
  | [.hostname, (.tags//[]|join(",")), .clientVersion, .os]
  | @tsv'

# If FIX=1, remove hardwareAttestation attr targets that hit tag:k8s / autogroup:member broadly
if [[ "${FIX_ATTESTATION:-0}" =~ ^(1|true|TRUE)$ ]]; then
  echo '== FIX: strip hardwareAttestation from nodeAttrs targeting k8s proxies =='
  FIXED=$(mktemp)
  python3 - "$ACL" "$FIXED" <<'PY'
import json,sys
cur=json.load(open(sys.argv[1]))
attrs=cur.get('nodeAttrs') or []
new=[]
for a in attrs:
    attr=a.get('attr') or []
    # drop hardware attestation requirements entirely for container-friendly fabric
    if any(x in ('hardwareAttestation','hardware-attestation','tpm') or 'attest' in str(x).lower() for x in attr):
        print('removing nodeAttr', a)
        continue
    new.append(a)
cur['nodeAttrs']=new
json.dump(cur, open(sys.argv[2],'w'), indent=2)
print('nodeAttrs count', len(attrs), '->', len(new))
PY
  ETAG=$(awk -F': ' 'BEGIN{IGNORECASE=1} /^etag:/{gsub(/\r/,"",$2); print $2; exit}' "$HDR")
  ARGS=(-H "$AUTH" -H 'Content-Type: application/json' -H 'Accept: application/json')
  [[ -n "$ETAG" ]] && ARGS+=(-H "If-Match: $ETAG")
  HTTP=$(curl -sS -o /tmp/acl-out.json -w '%{http_code}' "${ARGS[@]}" --data-binary @"$FIXED" "$API/tailnet/$TAILNET/acl")
  echo "POST ACL HTTP $HTTP"
  jq '.nodeAttrs // empty' /tmp/acl-out.json
  [[ "$HTTP" == "200" ]]
fi
