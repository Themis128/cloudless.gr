#!/usr/bin/env bash
# Provision the Cloudflare Access service token for postiz.cloudless.gr and
# wire it into the cloudless2 Worker (both production and staging).
#
# Requires:
#   CLOUDFLARE_API_TOKEN  — token with: Access:Service Tokens:Edit,
#                          Access:Apps and Policies:Edit,
#                          Workers Scripts:Edit
#   CLOUDFLARE_ACCOUNT_ID — cloudless account ID (default: fb7dc7b69b662480cd5961a4d1913c78,
#                          matching wrangler.jsonc)
#
# Idempotent: reuses an existing "cloudless-app" service token if present, and
# only appends a policy binding when one for that token doesn't already exist.
# Prints the Client Secret ONCE at the end — Cloudflare never shows it again.

set -euo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-fb7dc7b69b662480cd5961a4d1913c78}"
API="${CLOUDFLARE_API:-https://api.cloudflare.com/client/v4}"
APP_DOMAIN="${APP_DOMAIN:-postiz.cloudless.gr}"
TOKEN_NAME="${TOKEN_NAME:-cloudless-app}"
TOKEN_DURATION="${TOKEN_DURATION:-8760h}"    # 1 year
WORKER_PROD="${WORKER_PROD:-cloudless2}"
WORKER_STAGING="${WORKER_STAGING:-cloudless-gr-staging}"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "❌ CLOUDFLARE_API_TOKEN not set — mint one at https://dash.cloudflare.com/profile/api-tokens" >&2
  exit 1
fi

hdr=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json")

cf() {
  local method="$1" path="$2" body="${3:-}"
  local args=(--silent --show-error --fail-with-body -X "$method" "${hdr[@]}")
  [ -n "$body" ] && args+=(--data "$body")
  curl "${args[@]}" "${API}${path}"
}

need_jq() { command -v jq >/dev/null 2>&1 || { echo "❌ jq required" >&2; exit 1; }; }
need_jq

echo "─── 1/4  Verifying token scope ─────────────────────────────────────"
cf GET /user/tokens/verify | jq -r '.result | "  status: \(.status)  id: \(.id)"'

echo "─── 2/4  Ensuring service token '${TOKEN_NAME}' exists ─────────────"
existing=$(cf GET "/accounts/${ACCOUNT_ID}/access/service_tokens?per_page=1000" \
  | jq -r --arg n "$TOKEN_NAME" '.result[] | select(.name==$n) | .client_id' | head -n1)

if [ -n "$existing" ]; then
  echo "  reusing existing token client_id=${existing}"
  echo "  (client_secret is not retrievable — if you don't already have it,"
  echo "   delete this token in the dashboard and re-run to mint a fresh pair.)"
  CLIENT_ID="$existing"
  CLIENT_SECRET=""
else
  echo "  minting a new service token (${TOKEN_DURATION}) …"
  resp=$(cf POST "/accounts/${ACCOUNT_ID}/access/service_tokens" \
    "$(jq -cn --arg n "$TOKEN_NAME" --arg d "$TOKEN_DURATION" '{name:$n,duration:$d}')")
  CLIENT_ID=$(echo "$resp"    | jq -r '.result.client_id')
  CLIENT_SECRET=$(echo "$resp" | jq -r '.result.client_secret')
  echo "  minted client_id=${CLIENT_ID}"
fi

echo "─── 3/4  Attaching token to Access app '${APP_DOMAIN}' ─────────────"
app_uid=$(cf GET "/accounts/${ACCOUNT_ID}/access/apps?per_page=1000" \
  | jq -r --arg d "$APP_DOMAIN" '
      .result[]
      | select( (.domain // "") == $d or ((.self_hosted_domains // []) | index($d)) )
      | .uid' | head -n1)

if [ -z "$app_uid" ]; then
  echo "❌ No Access application found for ${APP_DOMAIN}. Create one in the dashboard:"
  echo "   Zero Trust → Access → Applications → Add → Self-hosted → ${APP_DOMAIN}"
  exit 1
fi
echo "  found app uid=${app_uid}"

policies=$(cf GET "/accounts/${ACCOUNT_ID}/access/apps/${app_uid}/policies")
already=$(echo "$policies" | jq -r --arg cid "$CLIENT_ID" '
  .result[]
  | select( (.include // []) | any( .service_token? | .token_id? == $cid ) )
  | .id' | head -n1)

if [ -n "$already" ]; then
  echo "  policy already binds this service token (policy id=${already}) — skipping"
else
  echo "  creating Service Auth policy for token ${CLIENT_ID} …"
  cf POST "/accounts/${ACCOUNT_ID}/access/apps/${app_uid}/policies" \
    "$(jq -cn --arg cid "$CLIENT_ID" '{
      name: "cloudless-app service token",
      decision: "non_identity",
      include: [ { service_token: { token_id: $cid } } ],
      precedence: 1
    }')" | jq -r '.result | "  created policy id=\(.id)"'
fi

echo "─── 4/4  Writing Worker secrets ───────────────────────────────────"
put_secret() {
  local worker="$1" name="$2" value="$3"
  if [ -z "$value" ]; then
    echo "  ⚠ skipping ${worker}/${name} — value unavailable (reused existing token)"
    return
  fi
  cf PUT "/accounts/${ACCOUNT_ID}/workers/scripts/${worker}/secrets" \
    "$(jq -cn --arg n "$name" --arg v "$value" '{name:$n, text:$v, type:"secret_text"}')" \
    | jq -r '.result | "  \(.name)  →  \(.type)  ✓"' \
    || echo "  ⚠ PUT ${worker}/${name} failed (script may not be deployed yet)"
}

for worker in "$WORKER_PROD" "$WORKER_STAGING"; do
  echo "  worker=${worker}"
  put_secret "$worker" POSTIZ_CF_ACCESS_CLIENT_ID "$CLIENT_ID"
  put_secret "$worker" POSTIZ_SERVICE_TOKEN       "$CLIENT_SECRET"
done

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo " Done.  Cloudflare deploys a new Worker version automatically the"
echo " moment secrets change — next request picks up the new bindings."
echo ""
if [ -n "$CLIENT_SECRET" ]; then
  echo " ⚠ Save these — Cloudflare will not show CLIENT_SECRET again:"
  echo "   POSTIZ_CF_ACCESS_CLIENT_ID = ${CLIENT_ID}"
  echo "   POSTIZ_SERVICE_TOKEN       = ${CLIENT_SECRET}"
fi
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Verify with:"
echo "  curl -sSI https://${APP_DOMAIN}/api/public/v1/integrations \\"
echo "    -H 'CF-Access-Client-Id: ${CLIENT_ID}' \\"
echo "    -H 'CF-Access-Client-Secret: <secret>' | head -5"
echo "→ expect HTTP/2 200 or 401 (from Postiz), NOT the CF Access login page."
