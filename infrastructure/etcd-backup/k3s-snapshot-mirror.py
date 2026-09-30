#!/usr/bin/env python3
"""Mirror k3s etcd snapshots from data-dir -> NAS backup mount.

Port of k3s-snapshot-mirror.sh.

Why this exists:
  /var/lib/rancher/k3s/server/db/snapshots/ holds the scheduled snapshots
  written by k3s itself (see etcd-snapshot-schedule-cron in
  /etc/rancher/k3s/config.yaml). The omv-backup-verify CronJob watches
  /srv/.../Backups/k3s-db/ for freshness with a 2h SLO. Previously the
  only thing mirroring to that path was /usr/local/sbin/nas-backup at
  02:00 daily, so the backup mount lagged up to 24h behind reality and
  the Slack alert fired all day.

Behaviour:
  - rsync -a --delete (drops snapshots that k3s retention has removed)
  - returns 0 if anything was synced or if the source is empty
  - logs to /var/log/k3s-snapshot-mirror.log

Driven by: /etc/systemd/system/k3s-snapshot-mirror.timer (every 30 min)
Source-of-truth: this file in cloudless.gr repo, infrastructure/etcd-backup/

Usage: python3 k3s-snapshot-mirror.py
"""

import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

SRC = Path("/var/lib/rancher/k3s/server/db/snapshots/")
DST = Path("/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/Backups/k3s-db/snapshots/")
LOG = Path("/var/log/k3s-snapshot-mirror.log")

STAMP = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

with LOG.open("a") as log:
    def w(msg: str) -> None:
        log.write(msg + "\n")

    w(f"[{STAMP}] === k3s-snapshot-mirror start ===")
    if not SRC.is_dir():
        w(f"[{STAMP}] WARN: source {SRC} does not exist; nothing to mirror")
        sys.exit(0)
    if not DST.is_dir():
        w(f"[{STAMP}] creating destination {DST}")
        subprocess.run(["install", "-d", "-m", "0700", "-o", "root", "-g", "root", str(DST)], check=True)
    r = subprocess.run(["rsync", "-a", "--delete", "--stats", str(SRC) + "/", str(DST) + "/"],
                       capture_output=True, text=True, check=False)
    w(r.stdout or "")
    if r.stderr:
        w(r.stderr)
    if r.returncode != 0:
        sys.exit(r.returncode)
    w(f"[{STAMP}] === k3s-snapshot-mirror done ===")
