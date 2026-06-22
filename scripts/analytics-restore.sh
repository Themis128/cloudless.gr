#!/usr/bin/env bash
#
# analytics-restore.sh — recover OOMKilled or crash-looping analytics workloads
# (Metabase and DuckDB API) in the analytics namespace.
#
# What it does:
#   1. Checks Metabase and DuckDB API pod states
#   2. If Metabase is OOMKilled/CrashLooping, patches its memory limit up
#      (default: 1Gi; JVM needs heap + ~200Mi non-heap — never cap below -Xmx)
#   3. Restarts affected deployments and waits for Ready
#   4. Reports before/after state
#
# Idempotent — safe to re-run. Only patches if the live state needs it.
#
# Env overrides:
#   METABASE_MEM_LIMIT   (default: 1Gi)
#   METABASE_JAVA_OPTS   (default: -Xmx768m -Xms128m)
#   DUCKDB_MEM_LIMIT     (default: 1500Mi — already generous, only raise if needed)
#   ANALYTICS_NS         (default: analytics)

set -uo pipefail

NS="${ANALYTICS_NS:-analytics}"
METABASE_MEM_LIMIT="${METABASE_MEM_LIMIT:-1Gi}"
METABASE_JAVA_OPTS="${METABASE_JAVA_OPTS:--Xmx768m -Xms128m}"
DUCKDB_MEM_LIMIT="${DUCKDB_MEM_LIMIT:-1500Mi}"

KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
export KUBECONFIG

note() { printf "[analytics-restore] %s\n" "$*"; }
k() { kubectl "$@" 2>&1 || true; }

note "=== analytics-restore $(date -u '+%F %T')Z ==="

pod_last_exit() {
  kubectl -n "$NS" get pods -l "app=$1" \
    -o jsonpath='{.items[0].status.containerStatuses[0].lastState.terminated.reason}' \
    2>/dev/null || echo ""
}
pod_restarts() {
  kubectl -n "$NS" get pods -l "app=$1" \
    -o jsonpath='{.items[0].status.containerStatuses[0].restartCount}' \
    2>/dev/null || echo "0"
}
deploy_live_limit() {
  kubectl -n "$NS" get deploy "$1" \
    -o jsonpath='{.spec.template.spec.containers[0].resources.limits.memory}' \
    2>/dev/null || echo "unknown"
}
deploy_ready() {
  kubectl -n "$NS" get deploy "$1" \
    -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0"
}

# ── Metabase ──────────────────────────────────────────────────────────────────
MB_RESTARTS=$(pod_restarts metabase)
MB_EXIT=$(pod_last_exit metabase)
MB_LIMIT=$(deploy_live_limit metabase)

note "Metabase: restarts=${MB_RESTARTS} lastExit=${MB_EXIT:-none} liveLimit=${MB_LIMIT}"

if [ "$MB_EXIT" = "OOMKilled" ] || [ "${MB_RESTARTS:-0}" -gt 3 ] || [ "$MB_LIMIT" = "400Mi" ] || [ "$MB_LIMIT" = "600Mi" ] || [ "$MB_LIMIT" = "unknown" ]; then
  note "Metabase needs recovery (OOMKilled or limit≤600Mi) → patching to ${METABASE_MEM_LIMIT}"
  PATCH=$(printf '{"spec":{"template":{"spec":{"containers":[{"name":"metabase","resources":{"requests":{"memory":"256Mi","cpu":"100m"},"limits":{"memory":"%s","cpu":"1"}},"env":[{"name":"JAVA_OPTS","value":"%s"},{"name":"MB_JETTY_MAXTHREADS","value":"20"}]}]}}}}' \
    "$METABASE_MEM_LIMIT" "$METABASE_JAVA_OPTS")
  kubectl -n "$NS" patch deploy metabase --type=strategic -p "$PATCH" >/dev/null 2>&1 && \
    note "  patched Metabase → ${METABASE_MEM_LIMIT} / ${METABASE_JAVA_OPTS}" || \
    note "  WARNING: patch failed"
  kubectl -n "$NS" rollout restart deploy/metabase >/dev/null 2>&1
  note "  waiting for Metabase rollout (up to 3 min)..."
  kubectl -n "$NS" rollout status deploy/metabase --timeout=180s >/dev/null 2>&1 || true
  note "  after rollout: limit=$(deploy_live_limit metabase) ready=$(deploy_ready metabase)"
else
  note "Metabase OK — no recovery needed"
fi

# ── DuckDB API ────────────────────────────────────────────────────────────────
DB_RESTARTS=$(pod_restarts duckdb-api)
DB_EXIT=$(pod_last_exit duckdb-api)
DB_LIMIT=$(deploy_live_limit duckdb-api)

note "DuckDB API: restarts=${DB_RESTARTS} lastExit=${DB_EXIT:-none} liveLimit=${DB_LIMIT}"

if [ "$DB_EXIT" = "OOMKilled" ] || [ "${DB_RESTARTS:-0}" -gt 5 ]; then
  note "DuckDB API OOMKilled → restarting (limit already ${DB_LIMIT})"
  kubectl -n "$NS" rollout restart deploy/duckdb-api >/dev/null 2>&1
  note "  waiting for DuckDB API rollout (up to 2 min)..."
  kubectl -n "$NS" rollout status deploy/duckdb-api --timeout=120s >/dev/null 2>&1 || true
  note "  after rollout: ready=$(deploy_ready duckdb-api)"
else
  note "DuckDB API OK — no recovery needed"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
note ""
note "=== Final state ==="
kubectl -n "$NS" get pods -o wide 2>&1 || true
note ""
note "=== DONE ==="
