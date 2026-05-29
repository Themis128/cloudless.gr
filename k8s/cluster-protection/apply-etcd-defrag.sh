#!/usr/bin/env bash
# Apply the etcd-defrag CronJob to the cluster.
#
# Idempotent. Safe to re-run.
#
# Usage:
#   bash k8s/cluster-protection/apply-etcd-defrag.sh
set -euo pipefail

REMOTE=${REMOTE:-192.168.1.128}
MANIFEST_DIR=$(cd "$(dirname "$0")" && pwd)

echo "==> Applying etcd-defrag CronJob"
ssh "$REMOTE" 'sudo kubectl --request-timeout=60s apply -f -' \
  < "$MANIFEST_DIR/etcd-defrag-cronjob.yaml"

echo
echo "==> Verify:"
ssh "$REMOTE" 'sudo kubectl -n monitoring get cronjob etcd-defrag'

echo
echo "==> Run a one-off now to validate:"
echo "    ssh $REMOTE 'sudo kubectl -n monitoring create job --from=cronjob/etcd-defrag etcd-defrag-manual-\$(date +%s)'"
echo "    ssh $REMOTE 'sudo kubectl -n monitoring logs -l app=etcd-defrag --tail=40 -f'"
