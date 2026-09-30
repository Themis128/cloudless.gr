#!/usr/bin/env python3
"""pi-disk-cleanup.py — Free disk space on the omv k3s Pi node.

Targets the biggest space hogs:
  1. Unused container images (crictl rmi --prune)
  2. Old container logs (/var/log/pods, journald vacuum)
  3. Old k3s server snapshots
  4. Build-runner caches + apt cache

Safe to re-run. Designed to run from CI over Tailscale + SSH, or
directly on the Pi."""

import os
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

DISK_MOUNT = os.environ.get(
    "DISK_MOUNT",
    "/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7")


def log(msg: str) -> None:
    print(f"[{datetime.now(timezone.utc):%H:%M:%S}] {msg}")


def run(cmd: list[str], tail: int = 0) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True)
    out = r.stdout + r.stderr
    if tail:
        out = "\n".join(out.splitlines()[-tail:]) + "\n"
    print(out, end="")


def disk_summary(header: str) -> None:
    log(header)
    subprocess.run(["df", "-h", "/", "/var/lib/rancher/k3s",
                    DISK_MOUNT], capture_output=False)
    log("--- Top-level space consumers on / ---")
    for p in ("/var/lib/rancher/k3s", "/var/log", "/var/cache",
              DISK_MOUNT):
        run(["du", "-sh", p])


def prune_images() -> None:
    log("Pruning unused container images...")
    if shutil.which("crictl"):
        run(["crictl", "rmi", "--prune"], tail=5)
    elif shutil.which("k3s"):
        run(["k3s", "crictl", "rmi", "--prune"], tail=5)
    else:
        log("  crictl/k3s not found — skipping image prune")


def prune_logs() -> None:
    log("Vacuuming journald (50M limit)...")
    run(["journalctl", "--vacuum-size=50M"], tail=3)

    log("Removing container logs older than 3 days...")
    pods = Path("/var/log/pods")
    now = time.time()
    if pods.is_dir():
        for f in pods.rglob("*.log*"):
            try:
                if now - f.stat().st_mtime > 3 * 86400:
                    f.unlink()
            except OSError:
                pass
        # Truncate large in-use logs (older than 1 day, > 10M)
        for f in pods.rglob("*.log"):
            try:
                st = f.stat()
                if st.st_size > 10 * 1024 * 1024 and \
                        now - st.st_mtime > 86400:
                    with open(f, "r+b") as fh:
                        fh.truncate(1024 * 1024)
            except OSError:
                pass


def prune_snapshots() -> None:
    log("Pruning k3s server snapshots (keeping last 2)...")
    snap_dir = Path("/var/lib/rancher/k3s/server/db/snapshots")
    if not snap_dir.is_dir():
        log("  Snapshot dir not found — skipping")
        return
    snaps = sorted(snap_dir.glob("*.db"),
                   key=lambda p: p.stat().st_mtime, reverse=True)
    if len(snaps) <= 2:
        log(f"  Only {len(snaps)} snapshot(s) — nothing to prune")
        return
    for f in snaps[2:]:
        try:
            f.unlink()
        except OSError:
            pass
    log(f"  Deleted {len(snaps) - 2} old snapshots")


def prune_caches() -> None:
    log("Cleaning apt cache...")
    subprocess.run(["apt-get", "clean"], capture_output=True)

    log("Removing old /tmp files (older than 7 days)...")
    now = time.time()
    for f in Path("/tmp").rglob("*"):
        try:
            if f.is_file() and now - f.stat().st_mtime > 7 * 86400:
                f.unlink()
        except OSError:
            pass


log("=== Pi disk cleanup started ===")
disk_summary("=== Disk usage (before cleanup) ===")

prune_images()
prune_logs()
prune_snapshots()
prune_caches()

print()
disk_summary("=== Disk usage (after cleanup) ===")
log("=== Cleanup complete ===")
