#!/usr/bin/env bash
# k3s datastore backup — SQLite (kine) edition.
#
# Why this exists:
#   The cluster migrated from etcd to the embedded SQLite/kine datastore on
#   2026-07-22 (data-dir: /srv/.../omv-ai-cluster/data, db/state.db + kine.sock).
#   The etcd-snapshot-schedule-cron in /etc/rancher/k3s/config.yaml is inert on
#   a SQLite datastore — no snapshots have been produced since Jul 22.
#
#   This script produces a consistent hot backup instead:
#     - sqlite3 .backup of state.db to a temp name, integrity_check, then
#       atomic rename (a failed run leaves no fresh-looking partial file)
#     - tar of server/{cred,tls,manifests,token,agent-token,etc} encrypted
#       with openssl AES-256 (key: /root/.k3s-backup-key, host-only, 0600) —
#       the tar contains TLS private keys + the secrets-encryption keys, so
#       it is never stored or uploaded in plaintext
#     - rclone copy to Cloudflare R2 datalake-bucket/k3s-state/ (off-site)
#   Output lands in Backups/k3s-db/ where the omv-backup-verify CronJob
#   checks freshness (<2h SLO). Runs hourly via k3s-state-backup.timer.
#
# Source-of-truth: cloudless.gr repo, infrastructure/k3s-backup/
#   rclone remote "r2" is configured at /root/.config/rclone/rclone.conf.
#   NOTE: the retired k3s-snapshot-mirror (rsync --delete into snapshots/)
#   was disabled+removed 2026-10-15 — it must never be re-enabled against
#   this destination dir.

set -euo pipefail

DATA_DIR="/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/omv-ai-cluster/data/server"
DST="/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/Backups/k3s-db/snapshots"
LOG="/var/log/k3s-state-backup.log"
KEYFILE="/root/.k3s-backup-key"
KEEP=48   # 48 hourly state.db backups + 48 config tars
STAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
TS="$(date -u '+%Y%m%d-%H%M%S')"
RC=0

{
  echo "[${STAMP}] === k3s-state-backup start ==="
  install -d -m 0700 -o root -g root "${DST}"

  # 1) Consistent online backup of the SQLite datastore — temp file first,
  #    integrity_check, then atomic rename so a failed/partial backup can
  #    never look fresh to the watchdog.
  TMP_DB="${DST}/.k3s-state-${TS}.db.tmp"
  rm -f "${TMP_DB}"
  if sqlite3 "${DATA_DIR}/db/state.db" ".backup '${TMP_DB}'" \
     && [ "$(sqlite3 "${TMP_DB}" 'PRAGMA integrity_check;' 2>/dev/null)" = "ok" ]; then
    mv "${TMP_DB}" "${DST}/k3s-state-${TS}.db"
    echo "[${STAMP}] state.db -> k3s-state-${TS}.db $(stat -c %s "${DST}/k3s-state-${TS}.db") bytes (integrity ok)"
  else
    rm -f "${TMP_DB}"
    echo "[${STAMP}] ERROR: state.db backup failed integrity check — no file produced"
    RC=1
  fi

  # 2) Config/identity material — encrypted before it touches disk as .enc.
  #    The plaintext tar exists only as openssl's stdin.
  if [ -f "${KEYFILE}" ]; then
    if tar -czf - -C "${DATA_DIR}" cred tls manifests token agent-token etc 2>/dev/null \
        | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:${KEYFILE}" \
            -out "${DST}/k3s-server-config-${TS}.tar.gz.enc"; then
      echo "[${STAMP}] server config -> k3s-server-config-${TS}.tar.gz.enc (aes-256-cbc)"
    else
      rm -f "${DST}/k3s-server-config-${TS}.tar.gz.enc"
      echo "[${STAMP}] ERROR: config tar pipeline failed — partial .enc removed"
      RC=1
    fi
  else
    echo "[${STAMP}] ERROR: ${KEYFILE} missing — skipping config backup (no plaintext fallback)"
    RC=1
  fi

  # 3) Off-site sync -> Cloudflare R2 datalake-bucket/k3s-state/, then
  #    prune remote objects older than the retention window so off-site
  #    storage stays bounded like the local copy.
  if command -v rclone >/dev/null 2>&1; then
    rclone copy "${DST}" "r2:datalake-bucket/k3s-state" \
      --include "k3s-state-*.db" --include "k3s-server-config-*.enc" \
      --max-age 2h --s3-upload-cutoff 64M --transfers 2 --low-level-retries 3 \
      --log-level INFO --log-file "${LOG}.rclone" \
      || { echo "[${STAMP}] ERROR: rclone off-site sync failed"; RC=1; }
    rclone delete "r2:datalake-bucket/k3s-state" \
      --include "k3s-state-*.db" --include "k3s-server-config-*.enc" \
      --min-age 48h --log-level INFO --log-file "${LOG}.rclone" \
      || { echo "[${STAMP}] ERROR: rclone remote prune failed"; RC=1; }
  else
    echo "[${STAMP}] ERROR: rclone not found — no off-site copy possible"
    RC=1
  fi

  # 4) Retention.
  ls -1t "${DST}"/k3s-state-*.db 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f
  ls -1t "${DST}"/k3s-server-config-*.enc 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f

  echo "[${STAMP}] === k3s-state-backup done (rc=${RC}) ==="
  exit "${RC}"
} >> "${LOG}" 2>&1
