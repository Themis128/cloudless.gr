#!/usr/bin/env bash
#
# wire-pi-cognito.sh — give the k3s `cloudless` app working Cognito auth.
#
# Looks up the Cognito pool/client
# from Cognito by name, fetches AUTH_SECRET from SSM (same as Lambda so
# failover sessions stay valid), stores everything in the cloudless-app-auth
# k8s Secret, and restarts the deployment.
#
# Requires: kubectl (cluster-admin) + aws CLI + AWS creds in env.

set -uo pipefail
NS="${NS:-cloudless}"
DEP="${DEP:-cloudless}"
SECRET="${SECRET:-cloudless-app-auth}"
SSM_PREFIX="${SSM_PREFIX:-/cloudless/production}"
POOL_NAME="${POOL_NAME:-cloudless-auth}"
CLIENT_NAME="${CLIENT_NAME:-cloudless-app}"
COGNITO_DOMAIN_URL="${COGNITO_DOMAIN_URL:-https://cloudless-auth.auth.us-east-1.amazoncognito.com}"
AUTH_URL_VAL="${AUTH_URL_VAL:-https://cloudless.gr}"
export AWS_REGION="${AWS_REGION:-us-east-1}"

command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found"; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "aws CLI not found"; exit 1; }

# Resolve pool ID by name (lists up to 60 pools — sufficient for this account)
echo "resolving Cognito pool '$POOL_NAME'..."
POOL_ID=$(aws cognito-idp list-user-pools --max-results 60 \
  --query "UserPools[?Name=='$POOL_NAME'].Id" --output text 2>/dev/null)
if [ -z "$POOL_ID" ] || [ "$POOL_ID" = "None" ]; then
  echo "ERROR: Cognito pool '$POOL_NAME' not found in $AWS_REGION. Is the SST deploy complete?"; exit 1
fi
echo "pool: $POOL_ID"

# Resolve client ID by name
echo "resolving app client '$CLIENT_NAME'..."
CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id "$POOL_ID" \
  --query "UserPoolClients[?ClientName=='$CLIENT_NAME'].ClientId" --output text 2>/dev/null)
if [ -z "$CLIENT_ID" ] || [ "$CLIENT_ID" = "None" ]; then
  echo "ERROR: app client '$CLIENT_NAME' not found in pool $POOL_ID"; exit 1
fi
echo "client: $CLIENT_ID"

# Fetch client secret (requires describe permission)
CLIENT_SECRET=$(aws cognito-idp describe-user-pool-client \
  --user-pool-id "$POOL_ID" --client-id "$CLIENT_ID" \
  --query 'UserPoolClient.ClientSecret' --output text 2>/dev/null)
if [ -z "$CLIENT_SECRET" ] || [ "$CLIENT_SECRET" = "None" ]; then
  echo "ERROR: no client secret (was generateSecret:true set?)"; exit 1
fi

COGNITO_ISSUER="https://cognito-idp.${AWS_REGION}.amazonaws.com/${POOL_ID}"

# Mask all secrets before any further output
for v in "$CLIENT_SECRET"; do echo "::add-mask::$v"; done

# Fetch AUTH_SECRET from SSM (same as Lambda — sessions are cross-replica valid)
AUTH_SECRET=$(aws ssm get-parameter --name "$SSM_PREFIX/AUTH_SECRET" \
  --with-decryption --query 'Parameter.Value' --output text 2>/dev/null)
if [ -z "$AUTH_SECRET" ]; then
  echo "ERROR: AUTH_SECRET not found in SSM at $SSM_PREFIX/AUTH_SECRET"; exit 1
fi
echo "::add-mask::$AUTH_SECRET"
echo "AUTH_SECRET fetched from SSM (len=${#AUTH_SECRET})"

echo "COGNITO_ISSUER=$COGNITO_ISSUER"
echo "CLIENT_ID(len=${#CLIENT_ID}) CLIENT_SECRET(len=${#CLIENT_SECRET})"

# Create/update the k8s secret with Cognito env vars
echo "creating/updating secret $SECRET in ns/$NS..."
kubectl -n "$NS" create secret generic "$SECRET" \
  --from-literal=AUTH_SECRET="$AUTH_SECRET" \
  --from-literal=AUTH_TRUST_HOST="true" \
  --from-literal=AUTH_URL="$AUTH_URL_VAL" \
  --from-literal=COGNITO_ISSUER="$COGNITO_ISSUER" \
  --from-literal=COGNITO_CLIENT_ID="$CLIENT_ID" \
  --from-literal=COGNITO_CLIENT_SECRET="$CLIENT_SECRET" \
  --from-literal=COGNITO_DOMAIN="$COGNITO_DOMAIN_URL" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null \
  && echo "secret applied"

# Patch envFrom: keep pi-standby-aws-creds + add cloudless-app-auth
echo "wiring envFrom on deploy/$DEP..."
kubectl -n "$NS" patch deploy "$DEP" --type=strategic -p \
  "{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"$DEP\",\"envFrom\":[{\"secretRef\":{\"name\":\"pi-standby-aws-creds\"}},{\"secretRef\":{\"name\":\"$SECRET\"}}]}]}}}}" \
  >/dev/null && echo "deployment patched"

kubectl -n "$NS" rollout restart "deploy/$DEP" >/dev/null
kubectl -n "$NS" rollout status "deploy/$DEP" --timeout=180s \
  || echo "rollout status timed out (continuing)"

echo "envFrom now:"
kubectl -n "$NS" get deploy "$DEP" \
  -o jsonpath='{range .spec.template.spec.containers[0].envFrom[*]}{.secretRef.name}{"\n"}{end}' 2>&1 \
  | sed 's/^/  /'

echo "verifying pi-origin auth (allow warm-up)..."
for i in $(seq 1 12); do
  P=$(curl -sS -m 8 "https://pi-origin.cloudless.gr/api/auth/providers" 2>/dev/null || echo "")
  if printf '%s' "$P" | grep -q '"cognito"'; then
    echo "PROVIDERS=ok (cognito listed)"; break
  fi
  echo "  attempt $i/12 — waiting 10s..."
  sleep 10
done

LOC=$(curl -sS -m 8 -c /tmp/pj -o /dev/null -w '' \
    "https://pi-origin.cloudless.gr/api/auth/csrf" 2>/dev/null
  CT=$(curl -sS -m 8 -b /tmp/pj "https://pi-origin.cloudless.gr/api/auth/csrf" \
    | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)
  curl -sS -m 8 -b /tmp/pj -o /dev/null -w '%{redirect_url}' \
    --data-urlencode "csrfToken=$CT" \
    --data-urlencode "callbackUrl=/en/dashboard" \
    "https://pi-origin.cloudless.gr/api/auth/signin/cognito" 2>/dev/null)
case "$LOC" in
  *amazoncognito.com*) echo "HANDOFF=ok (302 -> Cognito Hosted UI)";;
  *) echo "HANDOFF=check (got: ${LOC:-empty})";;
esac
echo "DONE wiring Pi Cognito auth."
