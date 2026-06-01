#!/usr/bin/env bash
#
# pi-auth-logs.sh — show the k3s cloudless app's auth wiring + the actual
# next-auth error in its logs (read-only), to pin down why auth fails on the Pi.

set -uo pipefail
NS="${NS:-cloudless}"
DEP="${DEP:-cloudless}"
command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found"; exit 1; }

echo "== pi-auth-logs $(date -u '+%F %T')Z =="
echo "## deployment envFrom:"
kubectl -n "$NS" get deploy "$DEP" -o jsonpath='{range .spec.template.spec.containers[0].envFrom[*]}{"  "}{.secretRef.name}{"\n"}{end}' 2>&1

echo "## cloudless-app-auth secret — key names + non-secret values:"
kubectl -n "$NS" get secret cloudless-app-auth -o jsonpath='{.data}' 2>/dev/null | grep -oE '"[^"]+":' | tr -d '":,' | sed 's/^/    /'
for k in KEYCLOAK_ISSUER KEYCLOAK_CLIENT_ID AUTH_URL AUTH_TRUST_HOST; do
  v=$(kubectl -n "$NS" get secret cloudless-app-auth -o jsonpath="{.data.$k}" 2>/dev/null | base64 -d 2>/dev/null)
  printf '    %s = %s\n' "$k" "$v"
done

echo "## pods:"
kubectl -n "$NS" get pods -l 'app.kubernetes.io/name=cloudless' -o wide 2>/dev/null || kubectl -n "$NS" get pods -o wide 2>&1 | grep -E "^NAME|cloudless" | grep -v keycloak

echo "## trigger an auth call then tail logs for the error:"
curl -sS -m 8 -o /dev/null "https://pi-origin.cloudless.gr/api/auth/providers" 2>/dev/null || true
sleep 2
kubectl -n "$NS" logs "deploy/$DEP" --tail=120 --all-containers 2>&1 \
  | grep -iE 'auth|error|keycloak|configuration|untrustedhost|trusthost|fetch failed|discovery|ECONN|ENOTFOUND|getServerSession|MissingSecret' \
  | tail -40 | sed 's/^/    /'
echo "_end pi-auth-logs_"
