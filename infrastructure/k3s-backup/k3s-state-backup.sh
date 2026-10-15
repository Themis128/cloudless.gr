#!/usr/bin/env bash
# k3s datastore backup — SQLite (kine) edition.
#
# Why this exists:
#   The cluster migrated from etcd to the embedded SQLite/kine datastore on
#   2026-07-22 (data-dir: /srv/.../omv-ai-cluster/data, db/state.db + kine.sock).
#   The etcd-snapshot-schedule-cron in /etc/rancher/k3s/config.yaml is inert on
#   a SQLite datastore — no snapshots have been produced since Jul 22.
#   This script produces a consistent hot backup instead:
#     - sqlite3 .backup of state.db (crash-safe, online)
#     - tar of server/{cred,tls,manifests,token,agent-token,etc} (restore material)
#     - rclone copy to Cloudflare R2 datalake-bucket/k3s-state/ (off-site)
#   Output lands in Backups/k3s-db/ where the omv-backup-verify CronJob
#   checks freshness (<2h SLO). Runs hourly via k3s-state-backup.timer.
#
# Source-of-truth: cloudless.gr repo, infrastructure/k3s-backup/
#   rclone remote "r2" is configured at /root/.config/rclone/rclone.conf.

set -euo pipefail

DATA_DIR="/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/omv-ai-cluster/data/server"
DST="/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/Backups/k3s-db/snapshots"
LOG="/var/log/k3s-state-backup.log"
KEEP=48   # 48 hourly state.db backups + 48 config tars
STAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
TS="$(date -u '+%Y%m%d-%H%M%S')"

{
  echo "[${STAMP}] === k3s-state-backup start ==="
  install -d -m 0700 -o root -g root "${DST}"

  # 1) Consistent online backup of the SQLite datastore.
  sqlite3 "${DATA_DIR}/db/state.db" ".backup '${DST}/k3s-state-${TS}.db'"
  echo "[${STAMP}] state.db -> k3s-state-${TS}.db $(stat -c %s "${DST}/k3s-state-${TS}.db") bytes"

  # 2) Config/identity material needed to restore (small).
  tar -czf "${DST}/k3s-server-config-${TS}.tar.gz" \
    -C "${DATA_DIR}" cred tls manifests token agent-token etc 2>/dev/null || true

  # 3) Off-site sync -> Cloudflare R2 datalake-bucket/k3s-state/
  if command -v rclone >/dev/null 2>&1; then
    rclone copy "${DST}" "r2:datalake-bucket/k3s-state" \
      --include "k3s-state-*.db" --include "k3s-server-config-*.tar.gz" \
      --max-age 2h --s3-upload-cutoff 64M --transfers 2 --low-level-retries 3 \
      --log-level INFO --log-file "${LOG}.rclone" \
      || echo "[${STAMP}] WARN: rclone off-site sync failed"
  fi

  # 4) Retention.
  ls -1t "${DST}"/k3s-state-*.db 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f
  ls -1t "${DST}"/k3s-server-config-*.tar.gz 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f

  echo "[${STAMP}] === k3s-state-backup done ==="
} >> "${LOG}" 2>&1
