#!/usr/bin/env bash
# Mirror k3s etcd snapshots from data-dir -> NAS backup mount.
#
# Why this exists:
#   /var/lib/rancher/k3s/server/db/snapshots/ holds the scheduled snapshots
#   written by k3s itself (see etcd-snapshot-schedule-cron in
#   /etc/rancher/k3s/config.yaml). The omv-backup-verify CronJob watches
#   /srv/.../Backups/k3s-db/ for freshness with a 2h SLO. Previously the
#   only thing mirroring to that path was /usr/local/sbin/nas-backup at
#   02:00 daily, so the backup mount lagged up to 24h behind reality and
#   the Slack alert fired all day.
#
# Behaviour:
#   - rsync -a --delete (drops snapshots that k3s retention has removed)
#   - returns 0 if anything was synced or if the source is empty
#   - logs to /var/log/k3s-snapshot-mirror.log
#
# Driven by: /etc/systemd/system/k3s-snapshot-mirror.timer (every 30 min)
# Source-of-truth: this file in cloudless.gr repo, infrastructure/etcd-backup/

set -euo pipefail

SRC="/var/lib/rancher/k3s/server/db/snapshots/"
DST="/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/Backups/k3s-db/snapshots/"
LOG="/var/log/k3s-snapshot-mirror.log"

STAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
{
  echo "[${STAMP}] === k3s-snapshot-mirror start ==="
  if [ ! -d "${SRC}" ]; then
    echo "[${STAMP}] WARN: source ${SRC} does not exist; nothing to mirror"
    exit 0
  fi
  if [ ! -d "${DST}" ]; then
    echo "[${STAMP}] creating destination ${DST}"
    install -d -m 0700 -o root -g root "${DST}"
  fi
  rsync -a --delete --stats "${SRC}" "${DST}"
  echo "[${STAMP}] === k3s-snapshot-mirror done ==="
} >> "${LOG}" 2>&1
