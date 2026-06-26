#!/usr/bin/env bash
# scripts/populate-kuma-secrets.sh
#
# Populates the `cluster-alerts-kuma` Secret with real Uptime Kuma push-monitor
# tokens after the operator has created the 7 monitors in the Kuma UI per
# skills/uptime-kuma-operator/SKILL.md ("Creating a push monitor (UI walkthrough)").
#
# Reads 7 positional args (one token per monitor), then applies the Secret to
# the monitoring ns AND replicates it into each backup-CronJob namespace
# (appflowy, espocrm, n8n, postiz) so cross-namespace references resolve.
#
# Idempotent: uses kubectl create … --dry-run=client -o yaml | kubectl apply -f -
# so it can be safely re-run on every token rotation.

set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 <K3S_POD_HEALTH> <ETCD_SNAPSHOT_AGE> <CLOUDFLARED_DRIFT> \\
          <BACKUP_APPFLOWY> <BACKUP_ESPOCRM> <BACKUP_N8N> <BACKUP_POSTIZ>

Each argument is the token portion of a Kuma push URL, e.g. for
  https://kuma.cloudless.gr/api/push/abc123XYZ
pass:
  abc123XYZ

Get the tokens by clicking the monitor in Kuma UI → "Push URL" field, copy
only the alphanumeric suffix.

Order matters. The 7 monitor names corresponding to each slot:
  1. k3s-pod-health        (omv-disk-watchdog every 15min)
  2. etcd-snapshot-age     (omv-backup-verify every 6h)
  3. cloudflared-drift     (cloudflared-drift-check every 6h)
  4. backup-appflowy       (pvc-backup-appflowy daily 03:30 UTC)
  5. backup-espocrm        (pvc-backup-espocrm daily 03:30 UTC)
  6. backup-n8n            (pvc-backup-n8n daily 03:30 UTC)
  7. backup-postiz         (pvc-backup-postiz daily 03:30 UTC)
USAGE
  exit 1
}

if [ "$#" -ne 7 ]; then
  echo "ERROR: expected 7 arguments, got $#" >&2
  echo >&2
  usage
fi

K3S_POD_HEALTH="$1"
ETCD_SNAPSHOT_AGE="$2"
CLOUDFLARED_DRIFT="$3"
BACKUP_APPFLOWY="$4"
BACKUP_ESPOCRM="$5"
BACKUP_N8N="$6"
BACKUP_POSTIZ="$7"

apply_secret() {
  local ns="$1"
  echo "→ applying cluster-alerts-kuma in namespace=${ns}"
  kubectl create secret generic cluster-alerts-kuma \
    --namespace="${ns}" \
    --from-literal=KUMA_PUSH_K3S_POD_HEALTH="${K3S_POD_HEALTH}" \
    --from-literal=KUMA_PUSH_ETCD_SNAPSHOT_AGE="${ETCD_SNAPSHOT_AGE}" \
    --from-literal=KUMA_PUSH_CLOUDFLARED_DRIFT="${CLOUDFLARED_DRIFT}" \
    --from-literal=KUMA_PUSH_BACKUP_APPFLOWY="${BACKUP_APPFLOWY}" \
    --from-literal=KUMA_PUSH_BACKUP_ESPOCRM="${BACKUP_ESPOCRM}" \
    --from-literal=KUMA_PUSH_BACKUP_N8N="${BACKUP_N8N}" \
    --from-literal=KUMA_PUSH_BACKUP_POSTIZ="${BACKUP_POSTIZ}" \
    --dry-run=client -o yaml | kubectl apply -f -
}

# monitoring ns hosts the 3 cluster-health CronJobs
apply_secret monitoring

# backup CronJobs live in each app's namespace and reference the Secret by name.
# Each app namespace gets its own copy.
for ns in appflowy espocrm n8n postiz; do
  if kubectl get namespace "${ns}" >/dev/null 2>&1; then
    apply_secret "${ns}"
  else
    echo "WARN: namespace ${ns} does not exist yet — skipping (backup CronJob will fail until created)" >&2
  fi
done

echo
echo "✅ done. Verify with:"
echo "    kubectl get secret cluster-alerts-kuma -n monitoring -o jsonpath='{.data}' | base64 -d 2>/dev/null"
echo "    or wait ~15min for omv-disk-watchdog to fire and check Kuma UI."