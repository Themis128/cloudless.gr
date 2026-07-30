#!/usr/bin/env bash
# pvc-backup-test.sh — create a one-shot Job from a pvc-backup CronJob in the
# correct namespace, wait for the pod, stream logs.
#
# Avoids "No resources found in <ns>" by always pairing CronJob ↔ namespace.
#
# Usage:
#   bash scripts/pvc-backup-test.sh list
#   bash scripts/pvc-backup-test.sh appflowy
#   bash scripts/pvc-backup-test.sh minio
#   bash scripts/pvc-backup-test.sh kuma

set -euo pipefail

# target|namespace|cronjob
TARGETS=(
  "appflowy|appflowy|pvc-backup-appflowy"
  "espocrm|espocrm|pvc-backup-espocrm"
  "postiz|postiz|pvc-backup-postiz"
  "n8n|n8n|pvc-backup-n8n"
  "minio|appflowy|pvc-backup-appflowy-minio"
  "appflowy-minio|appflowy|pvc-backup-appflowy-minio"
  "kuma|uptime-kuma|pvc-backup-uptime-kuma"
  "uptime-kuma|uptime-kuma|pvc-backup-uptime-kuma"
)

usage() {
  cat <<'EOF'
Usage: bash scripts/pvc-backup-test.sh <target|list>

Targets (CronJob lives in matching NS — do not guess -n):
  appflowy       → -n appflowy      pvc-backup-appflowy
  espocrm        → -n espocrm       pvc-backup-espocrm
  postiz         → -n postiz        pvc-backup-postiz
  n8n            → -n n8n           pvc-backup-n8n
  minio          → -n appflowy      pvc-backup-appflowy-minio
  kuma           → -n uptime-kuma   pvc-backup-uptime-kuma
EOF
}

resolve() {
  local want="$1" row t ns cj
  for row in "${TARGETS[@]}"; do
    IFS='|' read -r t ns cj <<<"$row"
    if [[ "$t" == "$want" ]]; then
      echo "$ns|$cj"
      return 0
    fi
  done
  return 1
}

list_targets() {
  printf '%-14s %-14s %s\n' TARGET NAMESPACE CRONJOB
  local row t ns cj seen=""
  for row in "${TARGETS[@]}"; do
    IFS='|' read -r t ns cj <<<"$row"
    case " $seen " in
      *" $cj "*) continue ;;
    esac
    seen+=" $cj"
    printf '%-14s %-14s %s\n' "$t" "$ns" "$cj"
  done
  echo
  echo "Live CronJobs:"
  kubectl get cronjob -A -l 'app.kubernetes.io/name=pvc-backup' \
    -o custom-columns='NAMESPACE:.metadata.namespace,NAME:.metadata.name,SCHEDULE:.spec.schedule' \
    2>/dev/null || kubectl get cronjob -A | grep pvc-backup || true
}

if [[ "${1:-}" == "" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 2
fi
if [[ "$1" == "list" ]]; then
  list_targets
  exit 0
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl not found" >&2
  exit 1
fi

resolved="$(resolve "$1" || true)"
if [[ -z "$resolved" ]]; then
  echo "Unknown target: $1" >&2
  usage >&2
  exit 2
fi
IFS='|' read -r NS CJ <<<"$resolved"
JOB="test-${1}-$(date +%s)"
JOB="${JOB//\//-}"

echo "→ namespace=$NS cronjob=$CJ job=$JOB"
if ! kubectl -n "$NS" get cronjob "$CJ" >/dev/null 2>&1; then
  echo "CronJob $CJ not found in namespace $NS" >&2
  echo "Hint: kubectl get cronjob -A | grep pvc-backup" >&2
  exit 1
fi

kubectl -n "$NS" create job --from="cronjob/${CJ}" "$JOB"
# TTL so manual tests do not litter the namespace (also set on CronJob Jobs)
kubectl -n "$NS" patch job "$JOB" --type=merge -p '{"spec":{"ttlSecondsAfterFinished":3600}}' >/dev/null 2>&1 || true
# Keep job briefly on failure for describe; delete on success via trap
CLEANUP=1
trap 'if [[ "${CLEANUP:-1}" == "1" ]]; then kubectl -n "$NS" delete job "$JOB" --wait=false >/dev/null 2>&1 || true; fi' EXIT

POD=""
for _ in $(seq 1 60); do
  # Always scope -n to CronJob NS; selector is job-name (created by Job controller)
  POD="$(kubectl -n "$NS" get pods -l "job-name=${JOB}" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  if [[ -n "$POD" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$POD" ]]; then
  echo "No pod appeared in namespace $NS for job-name=$JOB" >&2
  echo "Verify: kubectl -n $NS get cronjob,$JOB,pods -l job-name=$JOB" >&2
  kubectl -n "$NS" describe job "$JOB" >&2 || true
  CLEANUP=0
  exit 1
fi

echo "→ pod=$POD (ns=$NS)"
echo "   find later: kubectl -n $NS get pods -l job-name=$JOB"
echo "            or: kubectl -n $NS get pods -l app.kubernetes.io/name=pvc-backup"
kubectl -n "$NS" wait --for=condition=Ready "pod/${POD}" --timeout=120s 2>/dev/null || true
kubectl -n "$NS" logs -f "$POD"

# Job success?
if kubectl -n "$NS" wait --for=condition=complete "job/${JOB}" --timeout=60s 2>/dev/null; then
  echo "OK $JOB succeeded in ns=$NS"
  exit 0
fi
FAIL="$(kubectl -n "$NS" get job "$JOB" -o jsonpath='{.status.failed}' 2>/dev/null || echo 0)"
echo "ERROR $JOB did not complete successfully (failed=${FAIL:-0}) in ns=$NS" >&2
kubectl -n "$NS" get pod "$POD" -o wide >&2 || true
CLEANUP=0
exit 1
