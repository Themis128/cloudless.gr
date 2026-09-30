#!/usr/bin/env python3
"""Daily disk cleanup for omv-ha worker node (Pi).

Port of cloudless-cleanup.sh (omv-ha variant).
Installed 2026-06-16. Patched 2026-06-22 to wait for k3s containerd
socket before invoking crictl (cleanup-script race fix).

Companion to /etc/systemd/system/cloudless-cleanup.{timer,service}.
See CLAUDE.md "Pi Housekeeping" for the operator runbook.

Mirrors the omv-main script but skips docker / pnpm / buildx / VS Code
(not installed on omv-ha).
"""

import shutil
import subprocess
import time
from datetime import datetime
from pathlib import Path

LOG = Path("/var/log/cloudless-cleanup.log")


def log(msg: str) -> None:
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line)
    try:
        with LOG.open("a") as fh:
            fh.write(line + "\n")
    except OSError:
        pass


def run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(args), capture_output=True, text=True, check=False)


def run_tail(n: int, *args: str) -> None:
    r = run(*args)
    for line in ((r.stdout or "") + (r.stderr or "")).splitlines()[-n:]:
        log(f"  {line}")


def df_avail(path: str) -> int:
    r = run("df", "--output=avail", path)
    lines = (r.stdout or "").splitlines()
    return int(lines[-1].strip()) if len(lines) > 1 and lines[-1].strip().isdigit() else 0


log("=== Cleanup start (omv-ha) ===")
before_root = df_avail("/")

# 1. journalctl — keep only 14 days
run_tail(5, "journalctl", "--vacuum-time=14d")

# 2. apt cache
run("apt-get", "clean")

# 3. containerd image prune — k3s-agent uses /run/k3s/containerd/containerd.sock.
#    Tolerate startup race (cron can fire before k3s-agent finishes binding the
#    socket): wait up to 30s and pass --runtime-endpoint explicitly.
CRICTL_SOCK = Path("/run/k3s/containerd/containerd.sock")
CRICTL_SOCK_WAIT = 30
for _ in range(CRICTL_SOCK_WAIT // 5):
    if CRICTL_SOCK.exists():
        break
    time.sleep(5)
if shutil.which("k3s") and CRICTL_SOCK.exists():
    r = run("k3s", "crictl", "--runtime-endpoint", f"unix://{CRICTL_SOCK}", "rmi", "--prune")
    lines = [line for line in (r.stdout or "").splitlines() if "DeadlineExceeded" not in line]
    for line in lines[-5:]:
        log(f"  {line}")
else:
    log(f"crictl skipped: socket not ready after {CRICTL_SOCK_WAIT}s")

# 4. GitHub Actions runner _work dir — prune leftovers older than 7 days.
now = time.time()
DAY = 86400
for runner_dir in Path("/home/tbaltzakis").glob("actions-runner-*/_work"):
    if not runner_dir.is_dir():
        continue
    for f in (runner_dir / "_temp").iterdir() if (runner_dir / "_temp").is_dir() else []:
        try:
            if now - f.stat().st_mtime > 7 * DAY:
                if f.is_dir():
                    shutil.rmtree(f, ignore_errors=True)
                else:
                    f.unlink(missing_ok=True)
        except OSError:
            pass
    actions = runner_dir / "_actions"
    if actions.is_dir():
        for sub in actions.iterdir():
            if not sub.is_dir():
                continue
            for entry in sub.iterdir():
                try:
                    if entry.is_dir() and now - entry.stat().st_mtime > 14 * DAY:
                        shutil.rmtree(entry, ignore_errors=True)
                except OSError:
                    pass

# 5. stale VS Code Server dirs (defensive — keep newest 2 if any exist)
for d in (
    Path("/home/tbaltzakis/.vscode-server-insiders/cli/servers"),
    Path("/home/tbaltzakis/.vscode-server/cli/servers"),
):
    if not d.is_dir():
        continue
    versions = sorted(
        (p for p in d.iterdir() if p.is_dir()),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for old in versions[2:]:
        shutil.rmtree(old, ignore_errors=True)
        log(f"  removed old vscode server: {old.name}")

after_root = df_avail("/")
log(f"freed on / : {(after_root - before_root) // 1024} MB")
log("=== Cleanup done (omv-ha) ===")
