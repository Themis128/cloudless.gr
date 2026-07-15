#!/usr/bin/env bash
set -euo pipefail

ok=0
fail=0
warn=0

pass() {
  printf '✅ %s\n' "$*"
  ok=$((ok+1))
}

missing() {
  printf '❌ %s\n' "$*"
  fail=$((fail+1))
}

warning() {
  printf '⚠️  %s\n' "$*"
  warn=$((warn+1))
}

echo "== R21J Meilisearch live k3s readiness check =="
echo "Mode: read-only"
echo

if ! command -v kubectl >/dev/null 2>&1; then
  missing "kubectl is not installed or not on PATH"
  printf '\nSummary: %s passed, %s warnings, %s failures\n' "$ok" "$warn" "$fail"
  exit 1
fi

pass "kubectl is available"

if ! kubectl version --client >/dev/null 2>&1; then
  missing "kubectl client is not usable"
else
  pass "kubectl client is usable"
fi

if ! kubectl cluster-info >/dev/null 2>&1; then
  missing "kubectl cannot reach the current cluster"
  printf '\nSummary: %s passed, %s warnings, %s failures\n' "$ok" "$warn" "$fail"
  exit 1
fi

pass "kubectl can reach the current cluster"

if kubectl get storageclass local-path >/dev/null 2>&1; then
  pass "local-path storage class exists"
else
  missing "local-path storage class is missing"
fi

if kubectl get nodes -o name | grep -Eq '(^|/)omv$|omv-main|OMV-MAIN'; then
  pass "OMV node appears in cluster node list"
else
  missing "Could not find OMV/OMV-MAIN node in cluster node list"
fi

if kubectl get namespace search >/dev/null 2>&1; then
  pass "search namespace already exists"
else
  warning "search namespace does not exist yet; manifest will create it"
fi

if kubectl -n search get secret meilisearch-master-key >/dev/null 2>&1; then
  pass "meilisearch-master-key secret exists"
else
  warning "meilisearch-master-key secret is missing; create it before applying deployment"
fi

if kubectl -n search get pvc meilisearch-data >/dev/null 2>&1; then
  pass "meilisearch-data PVC already exists"
  kubectl -n search get pvc meilisearch-data

  pvc_phase="$(kubectl -n search get pvc meilisearch-data -o jsonpath='{.status.phase}')"
  if [[ "$pvc_phase" == "Bound" ]]; then
    pass "meilisearch-data PVC is Bound"
  else
    missing "meilisearch-data PVC is not Bound: $pvc_phase"
  fi
else
  warning "meilisearch-data PVC does not exist yet; manifest will create it"
fi

if kubectl -n search get pod -l app.kubernetes.io/name=meilisearch -o wide >/dev/null 2>&1; then
  pass "Meilisearch pod selector is queryable"
  kubectl -n search get pod -l app.kubernetes.io/name=meilisearch -o wide || true

  pod_nodes="$(kubectl -n search get pod -l app.kubernetes.io/name=meilisearch -o jsonpath='{range .items[*]}{.spec.nodeName}{"\n"}{end}')"
  if printf '%s\n' "$pod_nodes" | grep -Eq '^omv$|omv-main|OMV-MAIN'; then
    pass "Meilisearch pod is scheduled on OMV node"
  else
    missing "Meilisearch pod is not scheduled on OMV node: $pod_nodes"
  fi
else
  warning "No Meilisearch pod found yet"
fi

echo
printf 'Summary: %s passed, %s warnings, %s failures\n' "$ok" "$warn" "$fail"

[[ "$fail" -eq 0 ]]
