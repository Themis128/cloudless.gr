#!/usr/bin/env bash
# Idempotent Postiz installer for the omv-main k3s cluster.
#
# Run from the repo root, with KUBECONFIG already set (or
# ~/.kube/config wired up — the cluster-bash MCP / cluster-doctor /
# cluster-incident-response skills all keep this configured).
#
# What this does, in order:
#   1. Create namespace `postiz` if missing.
#   2. Bootstrap the `postiz-secrets` Secret if missing (JWT_SECRET +
#      POSTGRES_PASSWORD generated via openssl rand).
#   3. Bootstrap the `postiz-providers` Secret from SSM social-provider keys
#      if SSM access is available (FACEBOOK_APP_ID/SECRET, LINKEDIN_*,
#      X_API_KEY/SECRET, TIKTOK_*). Skipped quietly otherwise — the
#      Deployment marks it optional.
#   4. helm upgrade --install postiz ./helm/postiz -n postiz
#      -f ./helm/postiz/values-prod.yaml
#   5. Smoke check — wait for pod readiness and curl the in-cluster Service.
#
# Re-run any time — secrets are only created once; helm upgrade is no-op
# when nothing changed.

set -euo pipefail

NAMESPACE="${NAMESPACE:-postiz}"
RELEASE="${RELEASE:-postiz}"
CHART_DIR="$(cd "$(dirname "$0")" && pwd)"
VALUES_FILE="${CHART_DIR}/values-prod.yaml"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
warn() { printf "\033[33mWARN: %s\033[0m\n" "$*" >&2; }
die()  { printf "\033[31mERR: %s\033[0m\n" "$*" >&2; exit 1; }

command -v kubectl >/dev/null || die "kubectl not on PATH"
command -v helm >/dev/null    || die "helm not on PATH"
command -v openssl >/dev/null || die "openssl not on PATH"

bold "==> 1. namespace"
kubectl get ns "${NAMESPACE}" >/dev/null 2>&1 \
  || kubectl create namespace "${NAMESPACE}"

bold "==> 2. postiz-secrets"
if kubectl -n "${NAMESPACE}" get secret postiz-secrets >/dev/null 2>&1; then
  echo "    already exists — leaving it alone (rotate via kubectl edit)"
else
  JWT="$(openssl rand -hex 32)"
  PGPW="$(openssl rand -hex 24)"
  kubectl -n "${NAMESPACE}" create secret generic postiz-secrets \
    --from-literal=JWT_SECRET="${JWT}" \
    --from-literal=POSTGRES_PASSWORD="${PGPW}"
  echo "    created (32-byte JWT + 24-byte Postgres password)"
fi

bold "==> 3. postiz-providers (best-effort from SSM)"
if command -v aws >/dev/null && aws sts get-caller-identity >/dev/null 2>&1; then
  TMP="$(mktemp)"
  trap 'rm -f "${TMP}"' EXIT
  # Pull from /cloudless/production/* — silent on any missing key.
  read_ssm() {
    aws ssm get-parameter --name "/cloudless/production/$1" \
      --with-decryption --query 'Parameter.Value' --output text 2>/dev/null \
      || true
  }
  args=()
  # Map SSM aliases → Postiz env names (TikTok historically stored as APP_* / tiktok-client-*).
  resolve_ssm() {
    local dest_name="$1"; shift
    local candidate v=""
    for candidate in "$@"; do
      v="$(read_ssm "${candidate}")"
      if [ -n "${v}" ] && [ "${v}" != "None" ]; then
        printf '%s' "${v}"
        return
      fi
    done
    printf ''
  }
  set_if() {
    local k="$1" v="$2"
    if [ -n "${v}" ]; then
      args+=("--from-literal=${k}=${v}")
    fi
  }
  set_if FACEBOOK_APP_ID "$(resolve_ssm FACEBOOK_APP_ID FACEBOOK_APP_ID)"
  set_if FACEBOOK_APP_SECRET "$(resolve_ssm FACEBOOK_APP_SECRET FACEBOOK_APP_SECRET)"
  set_if LINKEDIN_CLIENT_ID "$(resolve_ssm LINKEDIN_CLIENT_ID LINKEDIN_CLIENT_ID)"
  set_if LINKEDIN_CLIENT_SECRET "$(resolve_ssm LINKEDIN_CLIENT_SECRET LINKEDIN_CLIENT_SECRET)"
  set_if X_API_KEY "$(resolve_ssm X_API_KEY X_API_KEY)"
  set_if X_API_SECRET "$(resolve_ssm X_API_SECRET X_API_SECRET)"
  set_if TIKTOK_CLIENT_ID "$(resolve_ssm TIKTOK_CLIENT_ID TIKTOK_CLIENT_ID TIKTOK_APP_ID tiktok-client-key)"
  set_if TIKTOK_CLIENT_SECRET "$(resolve_ssm TIKTOK_CLIENT_SECRET TIKTOK_CLIENT_SECRET TIKTOK_APP_SECRET tiktok-client-secret)"
  set_if POSTIZ_API_KEY "$(resolve_ssm POSTIZ_API_KEY POSTIZ_API_KEY)"
  if [ "${#args[@]}" -gt 0 ]; then
    if kubectl -n "${NAMESPACE}" get secret postiz-providers >/dev/null 2>&1; then
      kubectl -n "${NAMESPACE}" delete secret postiz-providers
    fi
    kubectl -n "${NAMESPACE}" create secret generic postiz-providers "${args[@]}"
    echo "    upserted ${#args[@]} provider keys"
  else
    warn "    no provider keys found in SSM — skipping"
  fi
else
  warn "    AWS CLI not available — skipping provider secret"
fi

bold "==> 4. helm upgrade --install"
helm upgrade --install "${RELEASE}" "${CHART_DIR}" \
  -n "${NAMESPACE}" \
  -f "${VALUES_FILE}" \
  --wait \
  --timeout 5m

bold "==> 5. smoke"
kubectl -n "${NAMESPACE}" rollout status deploy/postiz --timeout=120s
POD="$(kubectl -n "${NAMESPACE}" get pod -l app=postiz -o jsonpath='{.items[0].metadata.name}')"
echo "    pod: ${POD}"
kubectl -n "${NAMESPACE}" exec "${POD}" -- wget -q -O - http://localhost:5000 >/dev/null \
  || warn "    in-cluster GET / failed — check pod logs"

bold "==> done"
cat <<EOF

  Postiz endpoint (in-cluster):  http://postiz.${NAMESPACE}.svc.cluster.local:5000
  NodePort on omv-main:          http://192.168.1.128:30500
  Public URL (Cloudflare tunnel): https://postiz.cloudless.gr

  Verify channels:  curl -H "Authorization: \$POSTIZ_API_KEY" https://postiz.cloudless.gr/api/public/v1/integrations
  Tail logs:        kubectl -n ${NAMESPACE} logs deploy/postiz -f --tail=100
EOF
