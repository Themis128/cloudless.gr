#!/usr/bin/env bash
# Apply monitoring-resources.yaml against the live cluster.
#
# This is a thin wrapper around `kubectl apply` that adds the safety
# rails appropriate for editing live workloads on a host that has
# historically been overloaded.
#
# Usage:
#   bash k8s/cluster-protection/apply-monitoring-resources.sh
#
# Assumes you can `ssh 192.168.1.128` and that the remote user has
# `sudo k3s kubectl` available (or kubectl + KUBECONFIG configured).
set -euo pipefail

REMOTE=${REMOTE:-192.168.1.128}
MANIFEST_DIR=$(cd "$(dirname "$0")" && pwd)

echo "==> Pre-flight: confirming apiserver is responsive"
ssh "$REMOTE" 'for i in $(seq 1 12); do
  curl -sk --max-time 3 -o /dev/null -w "%{http_code}\n" \
    https://127.0.0.1:6443/livez | grep -qE "^(200|401)$" && exit 0
  sleep 5
done; echo "apiserver not responsive"; exit 1'

echo "==> Applying LimitRanges + ResourceQuotas"
ssh "$REMOTE" 'kubectl --request-timeout=60s apply -f -' \
  < "$MANIFEST_DIR/limit-ranges.yaml"

echo "==> Applying monitoring resource limits"
ssh "$REMOTE" 'kubectl --request-timeout=60s apply -f -' \
  < "$MANIFEST_DIR/monitoring-resources.yaml"

echo "==> Rolling out monitoring workloads to pick up new limits"
ssh "$REMOTE" 'kubectl --request-timeout=60s -n monitoring \
  rollout restart \
    statefulset/loki \
    daemonset/promtail \
    deployment/kube-prom-grafana \
    deployment/monitoring-operator \
    deployment/kube-prom-kube-state-metrics'

# Prometheus + Alertmanager are managed by the operator — it will
# reconcile the resource changes into the underlying StatefulSets
# within ~30s without us touching them.

echo "==> Done. Verify with:"
echo "    ssh $REMOTE 'kubectl -n monitoring get pods'"
echo "    ssh $REMOTE 'kubectl -n monitoring describe quota monitoring-quota'"
