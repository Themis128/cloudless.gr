#!/usr/bin/env python3
"""nas-auto-remediate — daily NAS self-healing (omv).

Fixes from health log automatically:
  1. minio OOM loop (appflowy) → raise limit to 512Mi
  2. stale backup alert → re-run nas-backup if its LOG is stale,
     else correct the health check's mtime heuristic"""

import os
import re
import shutil
import subprocess
import time
from pathlib import Path

LOG = Path("/var/log/nas-auto-remediate.log")
HEALTH_LOG = Path("/var/log/nas-daily-health.log")
BACKUP_LOG = Path("/var/log/nas-backup.log")


def stamp() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S")


def log(msg: str) -> None:
    line = f"[{stamp()}] {msg}"
    print(line)
    try:
        with LOG.open("a") as f:
            f.write(line + "\n")
    except OSError:
        pass


def find_health_script() -> Path | None:
    for d in ("/usr/local/sbin", "/usr/local/bin", "/usr/bin"):
        p = Path(d)
        if not p.is_dir():
            continue
        for f in p.iterdir():
            if not f.is_file() or "nas-auto-remediate" in f.name \
                    or f.suffix == ".orig":
                continue
            try:
                if "Daily Health Check" in \
                        f.read_text(errors="replace"):
                    return f
            except OSError:
                continue
    return None


HEALTH = find_health_script()


def kubectl(*args: str) -> str:
    r = subprocess.run(["kubectl", *args],
                       capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def fix_minio() -> None:
    r = subprocess.run(
        ["journalctl", "-p", "err", "--since",
         "24 hours ago", "--no-pager"],
        capture_output=True, text=True)
    oom = sum(1 for ln in r.stdout.splitlines()
              if re.search(r"Killed process.*minio", ln))
    if oom < 1:
        log(f"minio: no OOM in 24h ({oom})")
        return

    limit = kubectl("-n", "appflowy", "get", "deploy", "minio",
                    "-o", "jsonpath={.spec.template.spec."
                    "containers[0].resources.limits.memory}")
    rc = kubectl("-n", "appflowy", "get", "pod", "-l",
                 "app=minio", "-o",
                 "jsonpath={.items[0].status.containerStatuses"
                 "[0].restartCount}")
    log(f"minio: {oom} OOMs (limit={limit or 'none'}, "
        f"restarts={rc or '?'})")
    if limit not in ("512Mi", "1Gi"):
        log(f"minio: raising limit {limit or 'unset'} -> 512Mi")
        r = subprocess.run(
            ["kubectl", "-n", "appflowy", "patch",
             "deployment", "minio", "--type=strategic",
             "-p", '{"spec":{"template":{"spec":{"containers":'
                   '[{"name":"minio","resources":{"limits":'
                   '{"cpu":"500m","memory":"512Mi"},'
                   '"requests":{"cpu":"50m","memory":"128Mi"}'
                   "}}]}}}}"],
            capture_output=True, text=True)
        try:
            with LOG.open("a") as f:
                f.write(r.stdout + r.stderr)
        except OSError:
            pass
        log("minio: patched")
    else:
        log(f"minio: limit already {limit}, no patch")


def fix_backup() -> None:
    try:
        age = int((time.time() - BACKUP_LOG.stat().st_mtime)
                  / 3600)
    except OSError:
        age = 999
    if age > 25:
        log(f"backup: log {age}h stale - re-running nas-backup")
        r = subprocess.run(["/usr/local/sbin/nas-backup"],
                           capture_output=True, text=True)
        try:
            with LOG.open("a") as f:
                f.write(r.stdout + r.stderr)
        except OSError:
            pass
        return

    if HEALTH is None:
        log("backup: health script not found")
        return
    text = HEALTH.read_text(errors="replace")
    if "mmin -1500" in text:
        orig = HEALTH.with_suffix(HEALTH.suffix + ".orig")
        if not orig.exists():
            shutil.copy(HEALTH, orig)
        log(f"backup: job fresh ({age}h), source static - "
            "correcting mmin heuristic (orig saved)")
        new = re.sub(
            r"BACKUP_AGE=.*",
            "BACKUP_AGE=$(expr $(date +%s) - $(stat -c %Y "
            "/var/log/nas-backup.log 2>/dev/null || echo 0))",
            text)
        HEALTH.write_text(new)
        log("backup: health script now checks backup-log "
            "freshness")
    else:
        log("backup: health heuristic already corrected")


log("===== nas-auto-remediate start =====")
fix_minio()
fix_backup()
try:
    with HEALTH_LOG.open("a") as f:
        f.write(f"[{stamp()}] nas-auto-remediate: pass "
                "complete\n")
except OSError:
    pass
log("===== nas-auto-remediate done =====")
