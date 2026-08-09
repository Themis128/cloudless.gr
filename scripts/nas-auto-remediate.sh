#!/usr/bin/env bash
# nas-auto-remediate.sh - daily NAS self-healing (omv)
# Auto-fixes from the health log without manual intervention:
#   1. minio OOM-kill loop (appflowy ns) -> raise memory limit to 512Mi
#   2. Stale "Daily backup appears STALE" false positive -> re-point check
#      at the real backup pipeline (k3s-snapshot-mirror)
# Idempotent. Requires root + kubectl (cluster admin on omv host).
set -uo pipefail

LOG="/var/log/nas-auto-remediate.log"
HEALTH_LOG="/var/log/nas-daily-health.log"
HEALTH_SCRIPT="$(grep -rl 'nas-daily-health' /usr/local/bin /usr/bin /root 2>/dev/null | head -1)"

stamp() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(stamp)] $*" | tee -a "$LOG"; }

fix_minio_oom() {
  local oom_kills limit rc
  oom_kills=$(journalctl -p err --since "24 hours ago" --no-pager 2>/dev/null | grep -c 'Killed process.*minio' || true)
  [ "${oom_kills:-0}" -ge 1 ] || { log "minio: no OOM kills in 24h (${oom_kills:-0})"; return 0; }
  limit=$(kubectl -n appflowy get deploy minio -o jsonpath='{.spec.template.spec.containers[0].resources.limits.memory}' 2>/dev/null)
  rc=$(kubectl -n appflowy get pod -l app=minio -o jsonpath='{.items[0].status.containerStatuses[0].restartCount}' 2>/dev/null)
  log "minio: ${oom_kills} OOM kills in 24h (limit=${limit:-none}, restarts=${rc:-?})"
  if [ "${limit:-0}" != "512Mi" ] && [ "${limit:-0}" != "1Gi" ]; then
    log "minio: raising limit ${limit:-unset} -> 512Mi"
    kubectl -n appflowy patch deployment minio --type=strategic -p \
      '{"spec":{"template":{"spec":{"containers":[{"name":"minio","resources":{"limits":{"cpu":"500m","memory":"512Mi"},"requests":{"cpu":"50m","memory":"128Mi"}}}}]}}}' \
      >>"$LOG" 2>&1
    log "minio: patched, pod will roll"
  else
    log "minio: limit already ${limit}, no patch"
  fi
}

fix_stale_backup() {
  if [ -n "${HEALTH_SCRIPT}" ] && grep -q 'nas-backup' "${HEALTH_SCRIPT}"; then
    log "stale-backup: '${HEALTH_SCRIPT}' still checks disabled nas-backup unit"
    if grep -qE 'systemctl .*nas-backup|nas-backup .*has not run|systemctl .*status .*nas-backup' "${HEALTH_SCRIPT}"; then
      [ -f "${HEALTH_SCRIPT}.orig" ] || cp "${HEALTH_SCRIPT}" "${HEALTH_SCRIPT}.orig"
      log "stale-backup: correcting to k3s-snapshot-mirror (orig saved)"
      sed -i 's/nas-backup\.bak\.20260501\|nas-backup/k3s-snapshot-mirror/g' "${HEALTH_SCRIPT}" 2>/dev/null \
        || log "stale-backup: auto-patch failed, manual fix needed"
    fi
  else
    log "stale-backup: health script absent or already corrected"
  fi
}

main() {
  log "=========== nas-auto-remediate start ==========="
  fix_minio_oom
  fix_stale_backup
  echo "[$(stamp)] nas-auto-remediate: daily pass complete" >>"$HEALTH_LOG" 2>/dev/null || true
  log "=========== nas-auto-remediate done  ==========="
}
main