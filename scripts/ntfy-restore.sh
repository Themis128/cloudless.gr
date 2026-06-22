#!/usr/bin/env bash
#
# ntfy-restore.sh — recover ntfy (push notification server) from Error or
# CrashLoopBackOff state.
#
# ntfy is small but has been observed crashing with exit 1 after 34+ restarts
# (cluster snapshot 2026-06-01). The default 96Mi limit from memory-relief
# is tight — this script raises it if the pod is OOMKilling.
#
# What it does:
#   1. Checks ntfy pod state and restart count
#   2. If OOMKilled: raises memory limit (default: 128Mi)
#   3. If generic Error/CrashLoop: force-restarts the deployment
#   4. Waits for Ready and reports
#
# Idempotent — safe to re-run.
#
# Env overrides:
#   NTFY_MEM_LIMIT   (default: 128Mi)
#   NTFY_NS          (default: ntfy)

set -uo pipefail

NS="${NTFY_NS:-ntfy}"
NTFY_MEM_LIMIT="${NTFY_MEM_LIMIT:-128Mi}"

note() { printf "[ntfy-restore] %s\n" "$*"; }
k() { kubectl "$@" 2>&1 || true; }

note "=== ntfy-restore $(date -u '+%F %T')Z ==="

RESTARTS=$(kubectl -n "$NS" get pods -l app=ntfy \
  -o jsonpath='{.items[0].status.containerStatuses[0].restartCount}' \
  2>/dev/null || echo "0")
LAST_EXIT=$(kubectl -n "$NS" get pods -l app=ntfy \
  -o jsonpath='{.items[0].status.containerStatuses[0].lastState.terminated.reason}' \
  2>/dev/null || echo "")
WAIT_REASON=$(kubectl -n "$NS" get pods -l app=ntfy \
  -o jsonpath='{.items[0].status.containerStatuses[0].state.waiting.reason}' \
  2>/dev/null || echo "")
LIVE_LIMIT=$(kubectl -n "$NS" get deploy ntfy \
  -o jsonpath='{.spec.template.spec.containers[0].resources.limits.memory}' \
  2>/dev/null || echo "unknown")

note "ntfy: restarts=${RESTARTS} lastExit=${LAST_EXIT:-none} waiting=${WAIT_REASON:-none} liveLimit=${LIVE_LIMIT}"

printf "\n=== ntfy logs (last 20 lines before restore) ===\n"
k -n "$NS" logs deploy/ntfy --tail=20 || true

PATCHED=0
if [ "$LAST_EXIT" = "OOMKilled" ]; then
  note "OOMKilled → raising memory limit to ${NTFY_MEM_LIMIT}"
  PATCH=$(printf '{"spec":{"template":{"spec":{"containers":[{"name":"ntfy","resources":{"requests":{"memory":"32Mi","cpu":"10m"},"limits":{"memory":"%s","cpu":"200m"}}}]}}}}' \
    "$NTFY_MEM_LIMIT")
  kubectl -n "$NS" patch deploy ntfy --type=strategic -p "$PATCH" >/dev/null 2>&1 && \
    note "  patched ntfy → ${NTFY_MEM_LIMIT}" || note "  WARNING: patch failed"
  PATCHED=1
fi

if [ "$LAST_EXIT" = "Error" ] || [ "$WAIT_REASON" = "CrashLoopBackOff" ] || \
   [ "${RESTARTS:-0}" -gt 5 ] || [ "$PATCHED" = "1" ]; then
  note "Restarting ntfy deployment..."
  kubectl -n "$NS" rollout restart deploy/ntfy >/dev/null 2>&1
  note "Waiting for ntfy rollout (up to 90s)..."
  kubectl -n "$NS" rollout status deploy/ntfy --timeout=90s >/dev/null 2>&1 || true
else
  note "ntfy appears healthy — forcing restart to clear any stale state"
  kubectl -n "$NS" rollout restart deploy/ntfy >/dev/null 2>&1
  kubectl -n "$NS" rollout status deploy/ntfy --timeout=90s >/dev/null 2>&1 || true
fi

printf "\n=== ntfy pod state after restore ===\n"
kubectl -n "$NS" get pods -o wide 2>&1 || true
READY=$(kubectl -n "$NS" get deploy ntfy \
  -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
note "ready replicas: ${READY:-0}"

note ""
note "=== DONE ==="
