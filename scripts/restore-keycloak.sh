#!/usr/bin/env bash
#
# restore-keycloak.sh — bring auth.cloudless.gr back after an OOM / crash-loop.
#
# Directly patches the keycloak Deployment to a container size that fits its
# -Xmx512m heap (the original 2026-05-31 memory-relief cap of 384Mi could not
# hold it → OOMKilled). Verbose and self-verifying: prints the limit before,
# immediately after the patch, and again after a short wait (revert check), then
# restarts and waits for OIDC discovery to return 200. Does NOT use `set -e`, so
# it always runs to the end and reports — the workflow posts this log to the
# tracking issue.
#
# Requires a kubectl context with write access to the keycloak namespace (the
# restore-keycloak.yml workflow supplies one via Tailscale + KUBECONFIG_B64).
#
# Usage: bash scripts/restore-keycloak.sh

set -uo pipefail

NAMESPACE="${NAMESPACE:-keycloak}"
DEPLOYMENT="${DEPLOYMENT:-keycloak}"
DISCOVERY="${DISCOVERY:-https://auth.cloudless.gr/realms/master/.well-known/openid-configuration}"
MEM_LIMIT="${MEM_LIMIT:-768Mi}"
MEM_REQUEST="${MEM_REQUEST:-384Mi}"
HEAP="${HEAP:--Xms128m -Xmx512m -Djdk.reflect.useDirectMethodHandle=false -Dquarkus.http.limits.max-header-size=64K}"

log() { printf '[restore-kc] %s\n' "$*"; }
run() { log "\$ $*"; "$@"; log "(exit $?)"; }
limit() { kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" \
  -o jsonpath='{.spec.template.spec.containers[0].resources.limits.memory}' 2>&1; }

command -v kubectl >/dev/null 2>&1 || { echo "error: kubectl not found / no cluster access"; exit 1; }

log "whoami: $(kubectl auth whoami 2>&1 | tr '\n' ' ')"
log "memory limit BEFORE: $(limit)"

# Raise the namespace LimitRange max first so the new pod limit is admissible.
run kubectl -n "$NAMESPACE" patch limitrange default-container-limits --type=merge -p \
  '{"spec":{"limits":[{"type":"Container","max":{"memory":"1Gi","cpu":"2"},"default":{"memory":"512Mi","cpu":"1"},"defaultRequest":{"memory":"128Mi","cpu":"100m"}}]}}' || true

# Direct strategic-merge patch: size the container to fit the heap + set the
# operative heap variable (JAVA_OPTS_APPEND) explicitly.
PATCH=$(cat <<JSON
{"spec":{"template":{"spec":{"containers":[{"name":"$DEPLOYMENT",
  "resources":{"requests":{"memory":"$MEM_REQUEST","cpu":"100m"},"limits":{"memory":"$MEM_LIMIT","cpu":"1"}},
  "env":[{"name":"JAVA_OPTS_APPEND","value":"$HEAP"}]}]}}}}
JSON
)
run kubectl -n "$NAMESPACE" patch deploy "$DEPLOYMENT" --type=strategic -p "$PATCH"

log "memory limit IMMEDIATELY after patch: $(limit)"
sleep 15
log "memory limit after 15s (revert check): $(limit)"

run kubectl -n "$NAMESPACE" rollout restart "deploy/$DEPLOYMENT"
run kubectl -n "$NAMESPACE" rollout status  "deploy/$DEPLOYMENT" --timeout=210s

log "memory limit AFTER rollout: $(limit)"
kubectl -n "$NAMESPACE" get pods -l app="$DEPLOYMENT" -o wide 2>&1

log "Waiting for OIDC discovery to return 200…"
final=000
for i in $(seq 1 12); do
  final=$(curl -sS -m 8 -o /dev/null -w '%{http_code}' "$DISCOVERY" 2>/dev/null || echo 000)
  log "attempt $i: discovery HTTP $final"
  [ "$final" = "200" ] && { log "Keycloak is back up."; break; }
  sleep 10
done
[ "$final" = "200" ] || log "Keycloak still not 200 — see pod state above."
