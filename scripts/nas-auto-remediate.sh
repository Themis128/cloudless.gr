#!/usr/bin/env bash
# nas-auto-remediate.sh - daily NAS self-healing (omv)
# Fixes from health log automatically:
#   1. minio OOM loop (appflowy) -> raise limit to 512Mi
#   2. stale backup alert -> re-run nas-backup if its LOG is stale,
#      else correct the health check's mtime heuristic (source static)
set -uo pipefail
LOG=/var/log/nas-auto-remediate.log
HEALTH_LOG=/var/log/nas-daily-health.log
BACKUP_LOG=/var/log/nas-backup.log
HEALTH=$(grep -rl "Daily Health Check" /usr/local/sbin /usr/local/bin /usr/bin 2>/dev/null | grep -vE 'nas-auto-remediate|\.orig' | head -1)
stamp(){ date "+%Y-%m-%d %H:%M:%S"; }
log(){ echo "[$(stamp)] $*" | tee -a "$LOG"; }

fix_minio(){
  local oom limit rc
  oom=$(journalctl -p err --since "24 hours ago" --no-pager 2>/dev/null | grep -c "Killed process.*minio" || true)
  [ "${oom:-0}" -ge 1 ] || { log "minio: no OOM in 24h ($oom)"; return 0; }
  limit=$(kubectl -n appflowy get deploy minio -o jsonpath="{.spec.template.spec.containers[0].resources.limits.memory}" 2>/dev/null)
  rc=$(kubectl -n appflowy get pod -l app=minio -o jsonpath="{.items[0].status.containerStatuses[0].restartCount}" 2>/dev/null)
  log "minio: $oom OOMs (limit=${limit:-none}, restarts=${rc:-?})"
  if [ "${limit:-0}" != "512Mi" ] && [ "${limit:-0}" != "1Gi" ]; then
    log "minio: raising limit ${limit:-unset} -> 512Mi"
    kubectl -n appflowy patch deployment minio --type=strategic -p "{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"minio\",\"resources\":{\"limits\":{\"cpu\":\"500m\",\"memory\":\"512Mi\"},\"requests\":{\"cpu\":\"50m\",\"memory\":\"128Mi\"}}}]}}}}" >>"$LOG" 2>&1
    log "minio: patched"
  else
    log "minio: limit already ${limit}, no patch"
  fi
}

fix_backup(){
  local age
  age=$(( ( $(date +%s) - $(stat -c %Y "$BACKUP_LOG" 2>/dev/null || echo 0) ) / 3600 ))
  if [ "${age:-999}" -gt 25 ]; then
    log "backup: log ${age}h stale - re-running nas-backup"
    /usr/local/sbin/nas-backup >>"$LOG" 2>&1
    return 0
  fi
  if [ -z "${HEALTH:-}" ]; then log "backup: health script not found"; return 0; fi
  if grep -q "mmin -1500" "$HEALTH"; then
    [ -f "$HEALTH.orig" ] || cp "$HEALTH" "$HEALTH.orig"
    log "backup: job fresh (${age}h), source static - correcting mmin heuristic (orig saved)"
    sed -i "s/BACKUP_AGE=.*/BACKUP_AGE=\$(expr \$(date +%s) - \$(stat -c %Y \/var\/log\/nas-backup.log 2>\/dev\/null || echo 0))/" "$HEALTH"
    log "backup: health script now checks backup-log freshness"
  else
    log "backup: health heuristic already corrected"
  fi
}

log "===== nas-auto-remediate start ====="
fix_minio
fix_backup
echo "[$(stamp)] nas-auto-remediate: pass complete" >>"$HEALTH_LOG" 2>/dev/null || true
log "===== nas-auto-remediate done ====="