#!/usr/bin/env bash
#
# cluster-doctor.sh — read-only diagnostics for the omv k3s cluster, with a
# focus on why Keycloak (auth.cloudless.gr) might be down.
#
# Emits a Markdown report to stdout. Every kubectl call is best-effort (|| true)
# so the report is always produced even when individual objects are missing.
# Requires a kubectl context pointed at the cluster (the cluster-doctor.yml
# workflow supplies one via Tailscale + KUBECONFIG_B64).
#
# Usage:
#   bash scripts/cluster-doctor.sh
#   NAMESPACE=keycloak DEPLOYMENT=keycloak bash scripts/cluster-doctor.sh

set -uo pipefail

NAMESPACE="${NAMESPACE:-keycloak}"
DEPLOYMENT="${DEPLOYMENT:-keycloak}"
DISCOVERY="${DISCOVERY:-https://auth.cloudless.gr/realms/master/.well-known/openid-configuration}"

k() { kubectl "$@" 2>&1 || true; }
section() { printf "\n## %s\n\n" "$*"; }
fence()  { printf '```\n'; cat; printf '```\n'; }

printf "# Cluster snapshot — %s\n" "$(date -u '+%Y-%m-%d %H:%M:%SZ')"

section "auth.cloudless.gr"
code=$(curl -sS -m 8 -o /dev/null -w '%{http_code}' "$DISCOVERY" 2>/dev/null || echo 000)
printf "OIDC discovery: **HTTP %s** (200 = up)\n" "$code"

section "Nodes"
k get nodes -o wide | fence
k top nodes | fence

section "Node memory pressure / conditions"
for n in $(kubectl get nodes -o name 2>/dev/null | sed 's#node/##'); do
  printf "### %s\n" "$n"
  kubectl describe node "$n" 2>/dev/null \
    | grep -iE "MemoryPressure|DiskPressure|PIDPressure|Allocated resources|memory " \
    | head -20 | fence
done

section "Pods not Running/Completed (all namespaces)"
k get pods -A --field-selector=status.phase!=Running 2>/dev/null \
  | grep -vE "Completed|Succeeded" | fence

section "Keycloak: deployment"
k -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o wide | fence
printf "Resource limits/requests + heap env:\n"
kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" \
  -o jsonpath='{range .spec.template.spec.containers[*]}{.name}{"\n  limits="}{.resources.limits}{"\n  requests="}{.resources.requests}{"\n  env="}{range .env[*]}{.name}{"="}{.value}{" "}{end}{"\n"}{end}' \
  2>/dev/null | fence

section "Keycloak: pods"
k -n "$NAMESPACE" get pods -o wide | fence
printf "Container states (waiting/last-terminated reasons — look for OOMKilled / CrashLoopBackOff):\n"
kubectl -n "$NAMESPACE" get pods -o jsonpath='{range .items[*]}{.metadata.name}{":\n"}{range .status.containerStatuses[*]}{"  restarts="}{.restartCount}{" ready="}{.ready}{" waiting="}{.state.waiting.reason}{" lastTerminated="}{.lastState.terminated.reason}{"(exit "}{.lastState.terminated.exitCode}{")\n"}{end}{end}' \
  2>/dev/null | fence

section "Keycloak: recent events"
kubectl -n "$NAMESPACE" get events --sort-by=.lastTimestamp 2>/dev/null | tail -25 | fence

section "Keycloak: logs (current, last 40 lines)"
k -n "$NAMESPACE" logs "deploy/$DEPLOYMENT" --tail=40 | fence

section "Keycloak: logs (previous container, last 40 lines — crash cause)"
pod=$(kubectl -n "$NAMESPACE" get pods -l app="$DEPLOYMENT" -o name 2>/dev/null | head -1)
[ -n "$pod" ] && k -n "$NAMESPACE" logs "$pod" --previous --tail=40 | fence || printf "_no pod found via label app=%s_\n" "$DEPLOYMENT"

section "Identity & write permissions (can the CI kubeconfig recover Keycloak?)"
printf "whoami: %s\n" "$(kubectl auth whoami 2>&1 | tr '\n' ' ')"
for verb in get patch update; do
  printf "  can-i %-6s deployments -n %s : %s\n" "$verb" "$NAMESPACE" "$(kubectl auth can-i "$verb" deployments -n "$NAMESPACE" 2>&1)"
done
printf "  can-i patch  limitranges -n %s : %s\n" "$NAMESPACE" "$(kubectl auth can-i patch limitranges -n "$NAMESPACE" 2>&1)"
printf "  can-i create deployments/rollout (restart) -n %s : %s\n" "$NAMESPACE" "$(kubectl auth can-i patch deployments -n "$NAMESPACE" --subresource=scale 2>&1)"

section "Keycloak: rollout history (did a restart ever roll a new ReplicaSet?)"
k -n "$NAMESPACE" rollout history "deploy/$DEPLOYMENT" | fence

printf "\n_End of snapshot._\n"
