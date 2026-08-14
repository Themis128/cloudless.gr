#!/usr/bin/env bash
# Apply the 2026-05-31 cluster memory relief plan in safe order.
#
# Run on omv-main (or anywhere with kubectl context configured).
#
# Each step is idempotent. The script will:
#   1. Apply LimitRanges + per-deployment caps  (admission-time defaults)
#   2. Scale down unused workloads              (frees memory immediately)
#   3. Slim Prometheus scrape config            (forces pod restart)
#   4. Label cluster-health ServiceMonitors    (re-allows the 6 keepers)
#   5. Restart capped workloads                 (picks up new limits)
#   6. Verify and report
#
# Total expected memory freed on omv: ~1.85 GiB (from 6.1 GiB used → ~4.3 GiB)

set -euo pipefail

cd "$(dirname "$0")"

# Wait for kubectl to be responsive (cluster may be under load)
wait_for_api() {
  local n=0
  until kubectl get nodes >/dev/null 2>&1; do
    n=$((n+1))
    if [ "$n" -gt 30 ]; then
      echo "❌ kubectl API not responding after 5 min — aborting"
      exit 1
    fi
    echo "  ... waiting for k3s API (attempt $n/30)"
    sleep 10
  done
  echo "✓ k3s API responding"
}

echo "═══════════════════════════════════════════════════════════"
echo "  Cluster memory relief — 2026-05-31"
echo "═══════════════════════════════════════════════════════════"
echo ""
wait_for_api

echo ""
echo "── Step 1/6: Apply LimitRanges and deployment caps ──────────"
kubectl apply -f memory-relief-2026-05-31.yaml

echo ""
echo "── Step 2/6: Scale down unused workloads ────────────────────"
kubectl apply -f scale-down-unused.yaml

echo ""
echo "── Step 3/6: Slim Prometheus scrape config ──────────────────"
kubectl apply -f prometheus-slim.yaml

echo ""
echo "── Step 4/6: Label cluster-health ServiceMonitors ───────────"
# These are the ONLY scrape targets Prometheus will keep after step 3.
# Anything else gets dropped silently. After helm upgrade, re-run this step.
KEEPERS=(
  prometheus-node-exporter
  kube-prom-kube-state-metrics
  monitoring-prometheus
  kube-prom-kubelet
  kube-prom-apiserver
  kube-prom-coredns
  cloudflared
  tailscale
)
for sm in "${KEEPERS[@]}"; do
  if kubectl get servicemonitor -n monitoring "$sm" >/dev/null 2>&1; then
    kubectl label servicemonitor -n monitoring "$sm" \
      cluster-protection.io/health=true --overwrite
    echo "  ✓ labelled $sm"
  else
    echo "  ⚠ servicemonitor $sm not found (skip)"
  fi
done

echo ""
echo "── Step 5/6: Restart capped workloads to pick up new limits ─"
for ns_deploy in \
  "analytics deployment/metabase" \
  "n8n deployment/n8n" \
  "ntfy deployment/ntfy" \
  ; do
  ns="${ns_deploy%% *}"
  deploy="${ns_deploy##* }"
  if kubectl get -n "$ns" "$deploy" >/dev/null 2>&1; then
    kubectl rollout restart -n "$ns" "$deploy"
    echo "  ✓ restarted $ns/$deploy"
  fi
done

echo ""
echo "── Step 6/6: Verify (wait 60 s for things to settle) ────────"
sleep 60
echo ""
echo "Node memory:"
kubectl top nodes
echo ""
echo "Top 10 pods by memory after relief:"
kubectl top pods -A --no-headers 2>/dev/null | sort -k4 -h -r | head -10
echo ""
echo "Active Prometheus targets (should be ~6 jobs):"
kubectl exec -n monitoring prometheus-monitoring-prometheus-0 -c prometheus -- \
  wget -qO- http://localhost:9090/api/v1/targets \
  | grep -o '"job":"[^"]*"' | sort -u || echo "  (could not query — check pod status)"

echo ""
echo "✓ Done. If load is still > 6, run 'iostat -x 5' to inspect iowait."
