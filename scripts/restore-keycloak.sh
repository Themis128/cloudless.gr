#!/usr/bin/env bash
#
# restore-keycloak.sh — bring auth.cloudless.gr back after an OOM / crash-loop.
#
# Applies the corrected memory-relief manifest (Keycloak 480Mi / -Xmx256m) and
# restarts the keycloak Deployment, then waits for OIDC discovery to return 200.
#
# Requires a working kubectl context pointed at the omv k3s cluster (the
# restore-keycloak.yml workflow provides one via the KUBECONFIG_B64 secret;
# a human with cluster access can run this directly).
#
# Usage:
#   bash scripts/restore-keycloak.sh
#   NAMESPACE=keycloak DEPLOYMENT=keycloak bash scripts/restore-keycloak.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAMESPACE="${NAMESPACE:-keycloak}"
DEPLOYMENT="${DEPLOYMENT:-keycloak}"
MANIFEST="${MANIFEST:-$REPO_ROOT/k8s/cluster-protection/memory-relief-2026-05-31.yaml}"
DISCOVERY="${DISCOVERY:-https://auth.cloudless.gr/realms/master/.well-known/openid-configuration}"

log() { printf "\033[1;36m[restore-kc]\033[0m %s\n" "$*"; }

command -v kubectl >/dev/null 2>&1 || { echo "error: kubectl not found / no cluster access" >&2; exit 1; }

log "Before:"
kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o wide || true
kubectl -n "$NAMESPACE" get pods -l app="$DEPLOYMENT" -o wide || true

log "Applying $MANIFEST"
kubectl apply -f "$MANIFEST"

log "Restarting deploy/$DEPLOYMENT in ns/$NAMESPACE"
kubectl -n "$NAMESPACE" rollout restart "deploy/$DEPLOYMENT"
kubectl -n "$NAMESPACE" rollout status  "deploy/$DEPLOYMENT" --timeout=240s

log "After:"
kubectl -n "$NAMESPACE" get pods -l app="$DEPLOYMENT" -o wide || true

log "Waiting for OIDC discovery to return 200…"
for i in $(seq 1 18); do
  code=$(curl -sS -m 8 -o /dev/null -w '%{http_code}' "$DISCOVERY" 2>/dev/null || echo 000)
  log "attempt $i: discovery HTTP $code"
  if [ "$code" = "200" ]; then log "Keycloak is back up."; exit 0; fi
  sleep 10
done

echo "error: Keycloak still not returning 200 after restart" >&2
exit 1
