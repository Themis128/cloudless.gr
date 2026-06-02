#!/usr/bin/env bash
# One-shot: remove Content-Security-Policy from the Traefik secure-headers
# middleware in the cloudless namespace so the Next.js app's own full CSP
# (with object-src 'none', connect-src *.sentry.io, and per-request nonces)
# passes through to clients instead of being overwritten by the simplified
# Traefik version.
#
# Root cause: Traefik customResponseHeaders overwrites backend response headers.
# The simplified CSP in secure-headers was missing object-src and sentry.io,
# causing isLikelyAppResponse() in e2e/k3s/_helpers.ts to return false and
# failing the k3s standby smoke test.

set -euo pipefail

NS="${CLOUDLESS_NS:-cloudless}"
MW="secure-headers"

echo "[fix-traefik-csp] === fix-traefik-csp $(date -u '+%Y-%m-%d %H:%M:%SZ') ==="
echo "[fix-traefik-csp] Namespace: $NS  Middleware: $MW"

echo "[fix-traefik-csp] Current CSP in middleware:"
kubectl -n "$NS" get middleware "$MW" \
  -o jsonpath='{.spec.headers.customResponseHeaders.Content-Security-Policy}' 2>&1 || true
echo ""

echo "[fix-traefik-csp] Patching: removing Content-Security-Policy from customResponseHeaders..."
kubectl -n "$NS" patch middleware "$MW" --type=json \
  -p='[{"op":"remove","path":"/spec/headers/customResponseHeaders/Content-Security-Policy"}]' \
  2>&1 || { echo "[fix-traefik-csp] ERROR: patch failed"; exit 1; }

echo "[fix-traefik-csp] Patch applied. Verifying middleware spec:"
kubectl -n "$NS" get middleware "$MW" -o yaml 2>&1 | grep -A20 "customResponseHeaders:" || true

echo "[fix-traefik-csp] Probing pi-origin.cloudless.gr/api/health for updated CSP..."
csp_val=$(curl -sI --max-time 15 https://pi-origin.cloudless.gr/api/health 2>/dev/null \
  | grep -i '^content-security-policy:' | head -1 || true)
if [ -n "$csp_val" ]; then
  echo "[fix-traefik-csp] CSP header: $csp_val"
  if echo "$csp_val" | grep -q "object-src 'none'"; then
    echo "[fix-traefik-csp] PASS: object-src 'none' present — Next.js CSP is now served"
  else
    echo "[fix-traefik-csp] WARNING: object-src 'none' still missing — may need a pod restart"
  fi
else
  echo "[fix-traefik-csp] (could not read CSP from pi-origin — check manually)"
fi

echo "[fix-traefik-csp] === DONE ==="
