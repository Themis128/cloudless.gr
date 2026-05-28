#!/usr/bin/env bash
# Apply all cluster protection manifests against the live cluster.
#
# Usage:
#   bash k8s/cluster-protection/apply-all-guardrails.sh
#
# Assumes you can `ssh 192.168.1.128` and that the remote user has
# `sudo k3s kubectl` available.
set -euo pipefail

REMOTE=${REMOTE:-192.168.1.128}
MANIFEST_DIR=$(cd "$(dirname "$0")" && pwd)

echo "==> Pre-flight: confirming apiserver is responsive"
ssh "$REMOTE" 'for i in $(seq 1 12); do
  curl -sk --max-time 3 -o /dev/null -w "%{http_code}\n" \
    https://127.0.0.1:6443/livez | grep -qE "^(200|401)$" && exit 0
  sleep 5
done; echo "apiserver not responsive"; exit 1'

echo "==> Applying LimitRanges + ResourceQuotas (monitoring, cloudless)"
ssh "$REMOTE" 'kubectl --request-timeout=60s apply -f -' \
  < "$MANIFEST_DIR/limit-ranges.yaml"

echo "==> Applying Analytics guardrails"
ssh "$REMOTE" 'kubectl --request-timeout=60s apply -f -' \
  < "$MANIFEST_DIR/analytics-guardrails.yaml"

echo "==> Applying Generic guardrails (oncall, n8n, keycloak, home-assistant)"
ssh "$REMOTE" 'kubectl --request-timeout=60s apply -f -' \
  < "$MANIFEST_DIR/generic-guardrails.yaml"

echo "==> Applying explicit monitoring resource limits"
ssh "$REMOTE" 'kubectl --request-timeout=60s apply -f -' \
  < "$MANIFEST_DIR/monitoring-resources.yaml"

echo "==> Patching duckdb-api resources"
ssh "$REMOTE" 'kubectl --request-timeout=60s patch deployment duckdb-api -n analytics --patch-file /dev/stdin' \
  < "$MANIFEST_DIR/duckdb-api-resources.yaml"

echo "==> Rolling out affected workloads to pick up new limits"
ssh "$REMOTE" '
  kubectl -n monitoring rollout restart \
    statefulset/loki \
    deployment/kube-prom-grafana \
    deployment/monitoring-operator \
    deployment/kube-prom-kube-state-metrics
  
  kubectl -n analytics rollout restart deployment/duckdb-api
  
  kubectl -n cloudless rollout restart deployment/cloudless
'

echo "==> Done. Verify with:"
echo "    ssh $REMOTE 'kubectl get quota -A'"
