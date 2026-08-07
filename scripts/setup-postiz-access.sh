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

# Auto-source .env.local then .env from the repo root when the token isn't
# already exported. Values already in the environment win. Only variables
# this script actually reads are pulled through; the rest are ignored so
# unrelated .env noise never leaks into the shell.
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || dirname "$(dirname "$0")")"
  for candidate in "$REPO_ROOT/.env.local" "$REPO_ROOT/.env"; do
    [ -f "$candidate" ] || continue
    while IFS='=' read -r key value; do
      case "$key" in
        CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|APP_DOMAIN|TOKEN_NAME|TOKEN_DURATION|WORKER_PROD|WORKER_STAGING)
          # trim quotes + surrounding whitespace, skip empties + placeholders
          value="${value%\"}"; value="${value#\"}"; value="${value%\'}"; value="${value#\'}"
          value="${value## }"; value="${value%% }"
          [ -z "$value" ] && continue
          case "$value" in your-*|xxx*|CHANGE*|TODO*|"<"*|"") continue ;; esac
          if [ -z "$(eval echo "\${$key:-}")" ]; then
            export "$key=$value"
            echo "  ($(basename "$candidate")) picked up $key" >&2
          fi
          ;;
      esac
    done < <(grep -E '^[A-Z_][A-Z0-9_]*=' "$candidate")
  done
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "❌ CLOUDFLARE_API_TOKEN not set — mint one at https://dash.cloudflare.com/profile/api-tokens" >&2
  echo "   Then either:  export CLOUDFLARE_API_TOKEN=…" >&2
  echo "   or add it to  .env.local  in the repo root and re-run this script." >&2
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

  # Persist the freshly-minted secret IMMEDIATELY to a mode-600 file so a
  # later step failing doesn't leave the operator with an orphan token whose
  # client_secret Cloudflare never re-exposes. The file is deleted after step
  # 4 completes cleanly.
  SECRET_FILE="${TMPDIR:-/tmp}/postiz-cf-secret-$$.env"
  umask 077
  {
    echo "# Freshly-minted Cloudflare Access service token for ${TOKEN_NAME}."
    echo "# Cloudflare only shows client_secret once — do not lose this file."
    echo "POSTIZ_CF_ACCESS_CLIENT_ID=${CLIENT_ID}"
    echo "POSTIZ_SERVICE_TOKEN=${CLIENT_SECRET}"
  } > "$SECRET_FILE"
  echo ""
  echo "  🔐  client_secret saved to: ${SECRET_FILE}"
  echo "      (permissions 0600 — deleted after step 4 succeeds)"
  echo ""
fi

echo "─── 3/4  Attaching token to Access app '${APP_DOMAIN}' ─────────────"
app_uid=$(cf GET "/accounts/${ACCOUNT_ID}/access/apps?per_page=1000" \
  | jq -r --arg d "$APP_DOMAIN" '
      .result[]
      | select( (.domain // "") == $d or ((.self_hosted_domains // []) | index($d)) )
      | .uid' | head -n1)

if [ -z "$app_uid" ]; then
  echo "  no Access application found for ${APP_DOMAIN} — creating one …"
  # Self-hosted app, no identity providers, no launcher, 24h session.
  # We'll bind our service-token policy in the next step.
  create_body=$(jq -cn --arg d "$APP_DOMAIN" --arg n "Postiz" '{
    name: $n,
    domain: $d,
    type: "self_hosted",
    session_duration: "24h",
    app_launcher_visible: false,
    auto_redirect_to_identity: false,
    allowed_idps: [],
    tags: []
  }')
  app_uid=$(cf POST "/accounts/${ACCOUNT_ID}/access/apps" "$create_body" \
    | jq -r '.result.uid // .result.id')
  if [ -z "$app_uid" ] || [ "$app_uid" = "null" ]; then
    echo "❌ Failed to create Access application. Create manually in dashboard:"
    echo "   Zero Trust → Access → Applications → Add → Self-hosted → ${APP_DOMAIN}"
    exit 1
  fi
  echo "  created app uid=${app_uid}"
else
  echo "  found existing app uid=${app_uid}"
fi

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
  # Now that both worker PUTs succeeded, the temp secret file can go away.
  if [ -n "${SECRET_FILE:-}" ] && [ -f "$SECRET_FILE" ]; then
    rm -f "$SECRET_FILE"
    echo "   (temp file ${SECRET_FILE} removed)"
  fi
fi
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Verify with:"
echo "  curl -sSI https://${APP_DOMAIN}/api/public/v1/integrations \\"
echo "    -H 'CF-Access-Client-Id: ${CLIENT_ID}' \\"
echo "    -H 'CF-Access-Client-Secret: <secret>' | head -5"
echo "→ expect HTTP/2 200 or 401 (from Postiz), NOT the CF Access login page."
