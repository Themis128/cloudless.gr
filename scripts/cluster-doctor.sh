#!/usr/bin/env bash
#
# cluster-doctor.sh — read-only diagnostics for the omv k3s cluster, with a
# focus on why Keycloak (auth.cloudless.gr) might be down. [triggered 2026-06-02]
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

section "Keycloak deploy: ownership — who reconciles it (Helm/Argo/Flux)?"
printf "managed-by label: %s\n" "$(kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.metadata.labels.app\.kubernetes\.io/managed-by}' 2>&1)"
printf "ownerReferences:  %s\n" "$(kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.metadata.ownerReferences}' 2>&1)"
printf "GitOps annotations:\n"
kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.metadata.annotations}' 2>/dev/null \
  | tr ',' '\n' | grep -iE "helm|argocd|fluxcd|kustomize\.toolkit|reconcile|managed-by" | fence
printf "field managers (who last wrote each field):\n"
kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{range .metadata.managedFields[*]}{.manager}{" ("}{.operation}{", "}{.apiVersion}{")\n"}{end}' 2>&1 | fence
printf "live container[0] memory limit: %s\n" "$(kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].resources.limits.memory}' 2>&1)"
printf "last-applied (kubectl apply) memory limit: %s\n" "$(kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.metadata.annotations.kubectl\.kubernetes\.io/last-applied-configuration}' 2>/dev/null | grep -oE '\"memory\":\"[0-9]+Mi\"' | tail -1)"

# ── Prometheus health (PrometheusRuleFailures triage) ───────────────────────
PROM_NS="${PROM_NS:-monitoring}"
section "Prometheus: pods (restarts / OOM — is it starved like Keycloak was?)"
k -n "$PROM_NS" get pods -l app.kubernetes.io/name=prometheus -o wide | fence
printf "container states:\n"
kubectl -n "$PROM_NS" get pods -l app.kubernetes.io/name=prometheus -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{range .status.containerStatuses[*]}{"  "}{.name}{": restarts="}{.restartCount}{" ready="}{.ready}{" lastTerminated="}{.lastState.terminated.reason}{"\n"}{end}{end}' 2>&1 | fence
printf "prometheus container memory limit: %s\n" "$(kubectl -n "$PROM_NS" get sts -l app.kubernetes.io/name=prometheus -o jsonpath='{.items[0].spec.template.spec.containers[?(@.name=="prometheus")].resources.limits.memory}' 2>&1)"

section "Prometheus: failing rules (health != ok) + lastError"
# Curl the rules API from an in-cluster pod, parse with jq on the runner.
kubectl -n "$PROM_NS" run "promq-$$" --image=curlimages/curl:8.11.1 --restart=Never --rm -i --quiet \
  --command -- curl -sS --max-time 12 "http://prometheus-operated.${PROM_NS}.svc:9090/api/v1/rules" 2>/dev/null \
  > /tmp/promrules.json || true
if [ -s /tmp/promrules.json ]; then
  jq -r '
    [ .data.groups[]
      | .name as $g
      | .rules[]
      | select((.health != "ok") or ((.lastError // "") != ""))
      | "[\($g)] \(.name)  health=\(.health)  type=\(.type)\n    lastError: \(.lastError // "")"
    ] as $bad
    | if ($bad|length)==0 then "all rules healthy (no eval failures right now)"
      else $bad[] end
  ' /tmp/promrules.json 2>&1 | fence
  printf "rule groups total: %s, rules total: %s\n" \
    "$(jq '.data.groups|length' /tmp/promrules.json 2>/dev/null)" \
    "$(jq '[.data.groups[].rules[]]|length' /tmp/promrules.json 2>/dev/null)"
else
  printf "_could not fetch /api/v1/rules (empty response)_\n"
fi

section "cloudless app: deployment (k3s standby E2E target — ns cloudless)"
k -n cloudless get deploy cloudless -o wide | fence
printf "Resource limits + image:\n"
kubectl -n cloudless get deploy cloudless \
  -o jsonpath='{range .spec.template.spec.containers[*]}{.name}{"\n  image="}{.image}{"\n  limits="}{.resources.limits}{"\n  requests="}{.resources.requests}{"\n"}{end}' \
  2>/dev/null | fence
printf "Env vars (pi-origin 403 triage — HOSTNAME, AUTH_URL, APP_VERSION, envFrom):\n"
kubectl -n cloudless get deploy cloudless \
  -o jsonpath='{range .spec.template.spec.containers[*]}{range .env[*]}{.name}{"="}{.value}{"\n"}{end}{end}' \
  2>/dev/null | fence
printf "envFrom secrets: "
kubectl -n cloudless get deploy cloudless \
  -o jsonpath='{range .spec.template.spec.containers[*]}{range .envFrom[*]}{.secretRef.name}{" "}{end}{end}' \
  2>/dev/null
printf "\n"

section "cloudless app: all pods in ns cloudless"
k -n cloudless get pods -o wide | fence
printf "Container states:\n"
kubectl -n cloudless get pods -o jsonpath='{range .items[*]}{.metadata.name}{":\n"}{range .status.containerStatuses[*]}{"  restarts="}{.restartCount}{" ready="}{.ready}{" waiting="}{.state.waiting.reason}{" lastTerminated="}{.lastState.terminated.reason}{"(exit "}{.lastState.terminated.exitCode}{")\n"}{end}{end}' \
  2>/dev/null | fence

section "cloudless app: recent events (ns cloudless)"
kubectl -n cloudless get events --sort-by=.lastTimestamp 2>/dev/null | tail -20 | fence

section "cloudless app: logs (last 40 lines)"
k -n cloudless logs deploy/cloudless --tail=40 | fence

section "cloudless app: logs (previous container, last 40 lines)"
pod=$(kubectl -n cloudless get pods -l app=cloudless -o name 2>/dev/null | head -1)
[ -n "$pod" ] && k -n cloudless logs "$pod" --previous --tail=40 | fence || printf "_no cloudless pod found_\n"

printf "\n_End of snapshot._\n"

# fix-cloudless-ns-20260602
