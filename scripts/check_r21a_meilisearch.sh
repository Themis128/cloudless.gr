#!/usr/bin/env bash
set -euo pipefail

NS="${NS:-search}"
APP="${APP:-meilisearch}"
EXPECTED_NODE="${EXPECTED_NODE:-omv}"

ok=0
fail=0
warn=0

pass() {
  printf '✅ %s\n' "$*"
  ok=$((ok + 1))
}

missing() {
  printf '❌ %s\n' "$*"
  fail=$((fail + 1))
}

warning() {
  printf '⚠️  %s\n' "$*"
  warn=$((warn + 1))
}

echo "== R21a Meilisearch k3s check =="
echo "Namespace: $NS"
echo "Expected node: $EXPECTED_NODE"
echo

kubectl get ns "$NS" >/dev/null 2>&1 \
  && pass "namespace exists" \
  || missing "namespace $NS missing"

kubectl -n "$NS" get secret meilisearch-master-key >/dev/null 2>&1 \
  && pass "master key secret exists" \
  || missing "secret meilisearch-master-key missing"

kubectl -n "$NS" get deploy "$APP" >/dev/null 2>&1 \
  && pass "deployment exists" \
  || missing "deployment $APP missing"

kubectl -n "$NS" get svc "$APP" >/dev/null 2>&1 \
  && pass "service exists" \
  || missing "service $APP missing"

kubectl -n "$NS" get pvc meilisearch-data >/dev/null 2>&1 \
  && pass "PVC exists" \
  || missing "PVC meilisearch-data missing"

PVC_PHASE="$(kubectl -n "$NS" get pvc meilisearch-data -o jsonpath='{.status.phase}' 2>/dev/null || true)"
if [ "$PVC_PHASE" = "Bound" ]; then
  pass "PVC is Bound"
else
  missing "PVC phase is ${PVC_PHASE:-unknown}, expected Bound"
fi

READY="$(kubectl -n "$NS" get deploy "$APP" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
if [ "${READY:-0}" = "1" ]; then
  pass "deployment has 1 ready replica"
else
  missing "deployment readyReplicas is ${READY:-0}, expected 1"
fi

POD_COUNT="$(kubectl -n "$NS" get pod -l app.kubernetes.io/name=meilisearch --no-headers 2>/dev/null | wc -l | tr -d ' ')"
if [ "$POD_COUNT" = "1" ]; then
  pass "exactly one Meilisearch pod exists"
else
  warning "$POD_COUNT Meilisearch pods exist; rollout may still be settling"
fi

POD="$(kubectl -n "$NS" get pod -l app.kubernetes.io/name=meilisearch -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
NODE="$(kubectl -n "$NS" get pod "$POD" -o jsonpath='{.spec.nodeName}' 2>/dev/null || true)"

if [ "$NODE" = "$EXPECTED_NODE" ]; then
  pass "pod is scheduled on OMV-MAIN / $EXPECTED_NODE"
elif [ -n "$NODE" ]; then
  missing "pod is scheduled on $NODE, expected OMV-MAIN / $EXPECTED_NODE"
else
  missing "could not determine Meilisearch pod node"
fi

if [ -n "$POD" ]; then
  HEALTH="$(kubectl -n "$NS" exec "$POD" -- wget -qO- http://127.0.0.1:7700/health 2>/dev/null || true)"
  echo "$HEALTH" | grep -q '"status":"available"' \
    && pass "health endpoint reports available" \
    || missing "health endpoint did not report available: $HEALTH"
else
  missing "no Meilisearch pod found"
fi

PV="$(kubectl -n "$NS" get pvc meilisearch-data -o jsonpath='{.spec.volumeName}' 2>/dev/null || true)"
if [ -n "$PV" ]; then
  AFFINITY="$(kubectl get pv "$PV" -o yaml 2>/dev/null | grep -A12 nodeAffinity || true)"
  echo "$AFFINITY" | grep -q "$EXPECTED_NODE" \
    && pass "PV node affinity includes $EXPECTED_NODE" \
    || warning "could not confirm PV node affinity includes $EXPECTED_NODE"
else
  warning "could not determine PV name from PVC"
fi

echo
printf 'Summary: %s passed, %s warnings, %s failures\n' "$ok" "$warn" "$fail"

[[ "$fail" -eq 0 ]]
