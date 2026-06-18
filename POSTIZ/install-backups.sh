#!/usr/bin/env bash
# Wires CNPG -> R2 backups and MinIO -> R2 nightly mirror.
# Prereqs: install.sh has been run; both r2-creds.yaml files are filled;
#          you replaced <ACCOUNT_ID> in 07-backups/cnpg/cluster-patch.yaml.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

confirm_file_exists() {
  if [[ ! -f "$1" ]]; then
    echo "ERROR: $1 missing. Copy it from $1.example and fill in real values." >&2
    exit 1
  fi
}

echo "==> Pre-flight"
confirm_file_exists "$ROOT/07-backups/cnpg/r2-creds.yaml"
confirm_file_exists "$ROOT/07-backups/minio/r2-creds.yaml"

if grep -q '<ACCOUNT_ID>' "$ROOT/07-backups/cnpg/cluster-patch.yaml"; then
  echo "ERROR: replace <ACCOUNT_ID> in 07-backups/cnpg/cluster-patch.yaml first." >&2
  exit 1
fi

echo "==> CNPG R2 credentials"
kubectl apply -f "$ROOT/07-backups/cnpg/r2-creds.yaml"

echo "==> Patch postiz-pg Cluster with barmanObjectStore"
kubectl -n postiz patch cluster postiz-pg --type merge \
  --patch-file "$ROOT/07-backups/cnpg/cluster-patch.yaml"

echo "==> Scheduled nightly base backup"
kubectl apply -f "$ROOT/07-backups/cnpg/scheduledbackup.yaml"

echo "==> MinIO R2 credentials + mirror CronJob"
kubectl apply -f "$ROOT/07-backups/minio/r2-creds.yaml"
kubectl apply -f "$ROOT/07-backups/minio/mirror-cronjob.yaml"

echo
echo "DONE. Verify within 24h:"
echo "  - PG WAL archiving:   kubectl -n postiz get cluster postiz-pg -o jsonpath='{.status.firstRecoverabilityPoint}{\"\\n\"}'"
echo "  - PG base backups:    kubectl -n postiz get backups"
echo "  - MinIO mirror run:   kubectl -n postiz create job --from=cronjob/minio-r2-mirror minio-mirror-now"
echo "  - Restore drill:      see 07-backups/verify-restore.md"
