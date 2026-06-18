#!/usr/bin/env bash
# Idempotent installer for self-hosted Postiz on K3s.
# Re-runnable: every step uses `upgrade --install` / `apply` so it's safe to re-execute.
#
# Order: cert-manager -> CNPG operator -> MinIO operator -> namespaces & secrets
#        -> Postgres cluster -> Redis -> MinIO tenant -> Postiz -> Ingress
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NS=postiz

confirm_file_exists() {
  if [[ ! -f "$1" ]]; then
    echo "ERROR: $1 missing. Copy it from $1.example and fill in real values." >&2
    exit 1
  fi
}

echo "==> Pre-flight: required (non-example) secret files"
confirm_file_exists "$ROOT/01-cert-manager/cloudflare-api-token-secret.yaml"
confirm_file_exists "$ROOT/02-cnpg/postiz-db-secret.yaml"
confirm_file_exists "$ROOT/05-postiz/secrets-overrides.yaml"

echo "==> Adding Helm repos"
helm repo add jetstack         https://charts.jetstack.io               >/dev/null || true
helm repo add cnpg             https://cloudnative-pg.github.io/charts  >/dev/null || true
helm repo add minio-operator   https://operator.min.io                  >/dev/null || true
helm repo add bitnami          https://charts.bitnami.com/bitnami       >/dev/null || true
helm repo update

echo "==> Namespaces"
kubectl apply -f "$ROOT/00-namespace.yaml"

echo "==> cert-manager (+ CRDs)"
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set crds.enabled=true
kubectl apply -f "$ROOT/01-cert-manager/cloudflare-api-token-secret.yaml"
kubectl -n cert-manager rollout status deploy/cert-manager-webhook --timeout=180s
kubectl apply -f "$ROOT/01-cert-manager/clusterissuer.yaml"

echo "==> CloudNativePG operator + Postiz Postgres cluster"
helm upgrade --install cnpg cnpg/cloudnative-pg \
  --namespace cnpg-system --create-namespace
kubectl -n cnpg-system rollout status deploy/cnpg-cloudnative-pg --timeout=180s
kubectl apply -f "$ROOT/02-cnpg/postiz-db-secret.yaml"
kubectl apply -f "$ROOT/02-cnpg/cluster.yaml"
echo "    waiting for postiz-pg primary..."
kubectl -n $NS wait --for=condition=Ready cluster/postiz-pg --timeout=300s || true

echo "==> Bitnami Redis"
helm upgrade --install postiz-redis bitnami/redis \
  --namespace $NS \
  -f "$ROOT/03-redis/values.yaml"

echo "==> MinIO operator + Postiz tenant"
helm upgrade --install minio-operator minio-operator/operator \
  --namespace minio-operator --create-namespace
kubectl -n minio-operator rollout status deploy/minio-operator --timeout=180s
kubectl apply -f "$ROOT/04-minio/tenant.yaml"

echo "==> Postiz Helm release (chart-managed secrets)"
helm upgrade --install postiz oci://ghcr.io/gitroomhq/postiz-helmchart/charts/postiz-app \
  --namespace $NS \
  -f "$ROOT/05-postiz/values.yaml" \
  -f "$ROOT/05-postiz/secrets-overrides.yaml"

echo "==> Ingress (postiz.cloudless.gr)"
kubectl apply -f "$ROOT/05-postiz/ingress.yaml"

echo
echo "DONE. Next:"
echo "  1. Grab the Redis password and rerun this script after pasting it into"
echo "     05-postiz/secrets-overrides.yaml (REDIS_URL):"
echo "       kubectl -n $NS get secret postiz-redis -o jsonpath='{.data.redis-password}' | base64 -d"
echo "  2. Watch cert provisioning:"
echo "       kubectl -n $NS describe certificate postiz-tls"
echo "  3. App live at https://postiz.cloudless.gr once cert is Ready."
