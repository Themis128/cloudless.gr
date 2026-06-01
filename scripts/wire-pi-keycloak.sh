#!/usr/bin/env bash
#
# wire-pi-keycloak.sh — give the k3s `cloudless` app working Keycloak auth.
#
# The Pi standby's deployment has no AUTH_SECRET/KEYCLOAK_* env, so next-auth runs
# in disabled fallback mode (providers={}, no login handoff). This reads those
# values from SSM (/cloudless/production/* — the SAME source the Lambda uses, so
# AUTH_SECRET matches and failover sessions stay valid), stores them in a k8s
# Secret, wires it onto the deployment via envFrom (preserving pi-standby-aws-creds),
# and restarts. Values are masked; never printed or committed.
#
# Requires: kubectl (cluster-admin) + aws CLI + AWS creds in env (the workflow
# sources them from the pi-standby-aws-creds secret).
#
# NOTE: NEXT_PUBLIC_KEYCLOAK_ISSUER is build-time (baked into the client bundle),
# so the login *page* button still needs a Pi image rebuild (deploy-pi build-arg).
# This fixes the server-side auth API (providers, OIDC callback, session) — the
# part that matters for HA failover.

set -uo pipefail
NS="${NS:-cloudless}"
DEP="${DEP:-cloudless}"
SECRET="${SECRET:-cloudless-app-auth}"
SSM_PREFIX="${SSM_PREFIX:-/cloudless/production}"
export AWS_REGION="${AWS_REGION:-us-east-1}"

command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found"; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "aws CLI not found"; exit 1; }

get() { aws ssm get-parameter --name "$SSM_PREFIX/$1" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null; }
AUTH_SECRET=$(get AUTH_SECRET)
SSM_ISSUER=$(get KEYCLOAK_ISSUER)
KC_CID=$(get KEYCLOAK_CLIENT_ID)
KC_SECRET=$(get KEYCLOAK_CLIENT_SECRET)
for v in "$AUTH_SECRET" "$KC_SECRET" "$KC_CID"; do [ -n "$v" ] && echo "::add-mask::$v"; done

# The live app realm is `master` (the Lambda hands off there; admin/mapper/users
# are on master). SSM's KEYCLOAK_ISSUER is STALE (realm `cloudless`) — do NOT use
# it. Pin the Pi to the same realm the Lambda uses so sessions/users line up.
WANT_ISSUER="${KC_ISSUER_OVERRIDE:-https://auth.cloudless.gr/realms/master}"
KC_ISSUER="$WANT_ISSUER"
if [ -n "$SSM_ISSUER" ] && [ "$SSM_ISSUER" != "$WANT_ISSUER" ]; then
  echo "WARN: SSM KEYCLOAK_ISSUER='$SSM_ISSUER' is stale; using '$WANT_ISSUER' (the live Lambda realm)."
  # Best-effort: correct the SSM source of truth too (read-only creds will just fail harmlessly).
  aws ssm put-parameter --name "$SSM_PREFIX/KEYCLOAK_ISSUER" --type String --value "$WANT_ISSUER" --overwrite >/dev/null 2>&1 \
    && echo "SSM_FIXED: KEYCLOAK_ISSUER -> $WANT_ISSUER" || echo "SSM_NOT_FIXED: cannot write SSM (read-only creds) — recommend updating /cloudless/production/KEYCLOAK_ISSUER to $WANT_ISSUER manually."
fi

if [ -z "$AUTH_SECRET" ] || [ -z "$KC_CID" ]; then
  echo "ERROR: missing SSM values (AUTH_SECRET/CLIENT_ID). Aborting, no changes."; exit 1
fi
echo "using: AUTH_SECRET(len=${#AUTH_SECRET}) ISSUER=$KC_ISSUER CLIENT_ID(len=${#KC_CID}) CLIENT_SECRET(len=${#KC_SECRET})"

# AUTH_TRUST_HOST + AUTH_URL: Auth.js v5 reads these automatically. The Lambda
# gets them from sst.config.ts; without AUTH_TRUST_HOST=true Auth.js throws
# UntrustedHost ("server configuration" error). AUTH_URL is the canonical app URL
# (matches the client's registered redirect_uri), not the pi-origin host.
AUTH_URL_VAL="${AUTH_URL_VAL:-https://cloudless.gr}"
echo "creating/updating secret $SECRET in ns/$NS"
kubectl -n "$NS" create secret generic "$SECRET" \
  --from-literal=AUTH_SECRET="$AUTH_SECRET" \
  --from-literal=AUTH_TRUST_HOST="true" \
  --from-literal=AUTH_URL="$AUTH_URL_VAL" \
  --from-literal=KEYCLOAK_ISSUER="$KC_ISSUER" \
  --from-literal=KEYCLOAK_CLIENT_ID="$KC_CID" \
  --from-literal=KEYCLOAK_CLIENT_SECRET="$KC_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null && echo "secret applied (incl. AUTH_TRUST_HOST + AUTH_URL=$AUTH_URL_VAL)"

# Strategic-merge patch: merge into the named container; include BOTH envFrom
# entries (envFrom is a list and gets replaced) so we keep pi-standby-aws-creds.
echo "wiring envFrom on deploy/$DEP (preserving pi-standby-aws-creds)"
kubectl -n "$NS" patch deploy "$DEP" --type=strategic -p \
  "{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"$DEP\",\"envFrom\":[{\"secretRef\":{\"name\":\"pi-standby-aws-creds\"}},{\"secretRef\":{\"name\":\"$SECRET\"}}]}]}}}}" \
  >/dev/null && echo "deployment patched"

kubectl -n "$NS" rollout restart "deploy/$DEP" >/dev/null
kubectl -n "$NS" rollout status "deploy/$DEP" --timeout=180s || echo "rollout status timed out (continuing)"

echo "envFrom now:"
kubectl -n "$NS" get deploy "$DEP" -o jsonpath='{range .spec.template.spec.containers[0].envFrom[*]}{.secretRef.name}{"\n"}{end}' 2>&1 | sed 's/^/  /'

echo "verifying pi-origin auth (allow warm-up)…"
for i in $(seq 1 12); do
  P=$(curl -sS -m 8 "https://pi-origin.cloudless.gr/api/auth/providers" 2>/dev/null || echo "")
  if printf '%s' "$P" | grep -q '"keycloak"'; then echo "PROVIDERS=ok (keycloak listed)"; break; fi
  sleep 10
done
LOC=$(curl -sS -m 8 -c /tmp/pj -o /dev/null -w '' "https://pi-origin.cloudless.gr/api/auth/csrf" 2>/dev/null; \
  CT=$(curl -sS -m 8 -b /tmp/pj "https://pi-origin.cloudless.gr/api/auth/csrf" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4); \
  curl -sS -m 8 -b /tmp/pj -o /dev/null -w '%{redirect_url}' --data-urlencode "csrfToken=$CT" --data-urlencode "callbackUrl=/en/dashboard" "https://pi-origin.cloudless.gr/api/auth/signin/keycloak" 2>/dev/null)
case "$LOC" in
  *auth.cloudless.gr*openid-connect/auth*) echo "HANDOFF=ok (302 -> Keycloak PKCE)";;
  *) echo "HANDOFF=check (got: ${LOC:-empty})";;
esac
echo "DONE wiring Pi Keycloak auth."
