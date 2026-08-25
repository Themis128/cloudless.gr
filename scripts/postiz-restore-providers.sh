#!/usr/bin/env bash
# Recreate k8s secret postiz-providers from AWS SSM (or already-exported env).
# Never prints secret values. Does not read .env.local.
#
# Usage:
#   bash scripts/postiz-restore-providers.sh
#   # or with overrides already exported:
#   FACEBOOK_APP_ID=… bash scripts/postiz-restore-providers.sh
#
# Maps SSM aliases → Postiz env names:
#   TIKTOK_APP_ID / tiktok-client-key     → TIKTOK_CLIENT_ID
#   TIKTOK_APP_SECRET / tiktok-client-secret → TIKTOK_CLIENT_SECRET
set -euo pipefail

NAMESPACE="${NAMESPACE:-postiz}"
SECRET_NAME="${SECRET_NAME:-postiz-providers}"
SSM_PREFIX="${SSM_PREFIX:-/cloudless/production}"

read_ssm() {
  local name="$1"
  aws ssm get-parameter --name "${SSM_PREFIX}/${name}" \
    --with-decryption --query 'Parameter.Value' --output text 2>/dev/null \
    || true
}

# Resolve: prefer already-exported env, then primary SSM name, then aliases.
resolve() {
  local dest="$1"
  shift
  local cur="${!dest:-}"
  if [[ -n "${cur}" && "${cur}" != "None" ]]; then
    printf '%s' "${cur}"
    return
  fi
  local candidate
  for candidate in "$@"; do
    local v
    v="$(read_ssm "${candidate}")"
    if [[ -n "${v}" && "${v}" != "None" ]]; then
      printf '%s' "${v}"
      return
    fi
  done
  printf ''
}

if ! command -v aws >/dev/null || ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "ERROR: AWS CLI not authenticated — export keys manually or fix AWS creds." >&2
  exit 1
fi
if ! command -v kubectl >/dev/null; then
  echo "ERROR: kubectl not found." >&2
  exit 1
fi

FACEBOOK_APP_ID="$(resolve FACEBOOK_APP_ID FACEBOOK_APP_ID)"
FACEBOOK_APP_SECRET="$(resolve FACEBOOK_APP_SECRET FACEBOOK_APP_SECRET)"
LINKEDIN_CLIENT_ID="$(resolve LINKEDIN_CLIENT_ID LINKEDIN_CLIENT_ID)"
LINKEDIN_CLIENT_SECRET="$(resolve LINKEDIN_CLIENT_SECRET LINKEDIN_CLIENT_SECRET)"
X_API_KEY="$(resolve X_API_KEY X_API_KEY)"
X_API_SECRET="$(resolve X_API_SECRET X_API_SECRET)"
TIKTOK_CLIENT_ID="$(resolve TIKTOK_CLIENT_ID TIKTOK_CLIENT_ID TIKTOK_APP_ID tiktok-client-key)"
TIKTOK_CLIENT_SECRET="$(resolve TIKTOK_CLIENT_SECRET TIKTOK_CLIENT_SECRET TIKTOK_APP_SECRET tiktok-client-secret)"
POSTIZ_API_KEY="$(resolve POSTIZ_API_KEY POSTIZ_API_KEY)"

# Preserve existing POSTIZ_API_KEY from the live secret if SSM/env missing.
if [[ -z "${POSTIZ_API_KEY}" ]]; then
  POSTIZ_API_KEY="$(kubectl -n "${NAMESPACE}" get secret "${SECRET_NAME}" \
    -o jsonpath='{.data.POSTIZ_API_KEY}' 2>/dev/null | base64 -d 2>/dev/null || true)"
fi

args=()
found=()
missing=()
add() {
  local k="$1" v="$2"
  if [[ -n "${v}" ]]; then
    args+=("--from-literal=${k}=${v}")
    found+=("${k}")
  else
    missing+=("${k}")
  fi
}

add FACEBOOK_APP_ID "${FACEBOOK_APP_ID}"
add FACEBOOK_APP_SECRET "${FACEBOOK_APP_SECRET}"
add LINKEDIN_CLIENT_ID "${LINKEDIN_CLIENT_ID}"
add LINKEDIN_CLIENT_SECRET "${LINKEDIN_CLIENT_SECRET}"
add X_API_KEY "${X_API_KEY}"
add X_API_SECRET "${X_API_SECRET}"
add TIKTOK_CLIENT_ID "${TIKTOK_CLIENT_ID}"
add TIKTOK_CLIENT_SECRET "${TIKTOK_CLIENT_SECRET}"
add POSTIZ_API_KEY "${POSTIZ_API_KEY}"

if [[ ${#found[@]} -eq 0 ]]; then
  echo "ERROR: no provider keys resolved." >&2
  exit 1
fi

echo "Will upsert secret/${SECRET_NAME} in ns/${NAMESPACE} with: ${found[*]}"
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing (channel connect for these will fail until set): ${missing[*]}"
fi

kubectl -n "${NAMESPACE}" delete secret "${SECRET_NAME}" --ignore-not-found
kubectl -n "${NAMESPACE}" create secret generic "${SECRET_NAME}" "${args[@]}"
kubectl -n "${NAMESPACE}" rollout restart "deploy/postiz"
kubectl -n "${NAMESPACE}" rollout status "deploy/postiz" --timeout=180s

echo "Verify env keys present in pod (names only):"
kubectl -n "${NAMESPACE}" exec deploy/postiz -- sh -c \
  'for k in FACEBOOK_APP_ID FACEBOOK_APP_SECRET LINKEDIN_CLIENT_ID LINKEDIN_CLIENT_SECRET X_API_KEY X_API_SECRET TIKTOK_CLIENT_ID TIKTOK_CLIENT_SECRET POSTIZ_API_KEY; do
     if [ -n "$(printenv "$k")" ]; then echo "  OK $k"; else echo "  MISSING $k"; fi
   done'

echo
echo "Next: connect channels in https://postiz.cloudless.gr"
echo "  Redirect URI: https://postiz.cloudless.gr/integrations/social/<provider>"
echo "  P0: linkedin (page), x, facebook+instagram, bluesky (no env)"
