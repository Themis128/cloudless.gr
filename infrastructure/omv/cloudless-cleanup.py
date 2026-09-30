#!/usr/bin/env python3
"""Daily disk cleanup for omv control-plane node (Pi 5).

Port of cloudless-cleanup.sh.
Companion to /etc/systemd/system/cloudless-cleanup.{timer,service}.
See CLAUDE.md "Pi Housekeeping" for the operator runbook.

More aggressive than the omv-ha variant because the control plane runs:
  • Docker (for GH Actions runner arm64 builds)
  • pnpm + buildx (Next.js CI builds)
  • k3s containerd (multi-namespace — larger image cache)
  • 3 GH self-hosted runners (/home/tbaltzakis/actions-runner-*)
  • VS Code Server remote

Ordered by impact — biggest space savers first.
"""

import os
import re
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


log("=== Cleanup start (omv-main) ===")
before_root = df_avail("/")

# ── 1. Docker — images, stopped containers, unused volumes, buildx ──────────
if shutil.which("docker"):
    log("Docker: pruning stopped containers + dangling images...")
    run_tail(3, "docker", "container", "prune", "-f")

    log("Docker: pruning unused images (not pulled in 48h)...")
    run_tail(3, "docker", "image", "prune", "-a", "--filter", "until=48h", "-f")

    log("Docker: pruning unused volumes...")
    run_tail(2, "docker", "volume", "prune", "-f")

    log("Docker: pruning buildx cache (> 10GB kept)...")
    run_tail(3, "docker", "buildx", "prune", "--keep-storage=10GB", "-f")
else:
    log("Docker not found — skipping Docker pruning")

# ── 2. GitHub Actions runner caches ──────────────────────────────────────────
now = time.time()
DAY = 86400


def prune_dirs(root: Path, min_depth_from_root: int, age_days: int,
               pred=None) -> None:
    """Remove dirs under `root` older than age_days (by atime approx via mtime)."""
    if not root.is_dir():
        return
    for dirpath, dirnames, _files in os.walk(root):
        rel_depth = len(Path(dirpath).relative_to(root).parts)
        if rel_depth != min_depth_from_root:
            continue
        for d in list(dirnames):
            p = Path(dirpath) / d
            if pred and not pred(p):
                continue
            try:
                if now - p.stat().st_mtime > age_days * DAY:
                    shutil.rmtree(p, ignore_errors=True)
            except OSError:
                pass


for runner_dir in Path("/home/tbaltzakis").glob("actions-runner-*"):
    work = runner_dir / "_work"
    if not work.is_dir():
        continue

    # node_modules inside _work are the biggest hog; safe to nuke after 3 days
    prune_dirs(work, 3, 3, pred=lambda p: p.name == "node_modules")

    # _temp: always safe to prune entries older than 1 day
    temp_dir = work / "_temp"
    if temp_dir.is_dir():
        for entry in temp_dir.iterdir():
            try:
                if now - entry.stat().st_mtime > DAY:
                    if entry.is_dir():
                        shutil.rmtree(entry, ignore_errors=True)
                    else:
                        entry.unlink(missing_ok=True)
            except OSError:
                pass

    # _actions: prune entries not used in 14 days
    prune_dirs(work / "_actions", 2, 14)

    log(f"Cleaned {runner_dir}/_work")

# ── 3. pnpm content-addressable store ────────────────────────────────────────
if shutil.which("pnpm"):
    log("pnpm: pruning store...")
    run_tail(3, "pnpm", "store", "prune")

pnpm_store_root = Path("/root/.local/share/pnpm/store")
if pnpm_store_root.is_dir():
    for f in pnpm_store_root.rglob("*.tgz"):
        try:
            if f.stat().st_atime < now - 30 * DAY:
                f.unlink(missing_ok=True)
        except OSError:
            pass

# ── 4. containerd (k3s) image prune ─────────────────────────────────────────
CRICTL_SOCK = Path("/run/k3s/containerd/containerd.sock")
for _ in range(6):
    if CRICTL_SOCK.exists():
        break
    time.sleep(5)
if shutil.which("k3s") and CRICTL_SOCK.exists():
    log("crictl: pruning unused images...")
    r = run("k3s", "crictl", "--runtime-endpoint", f"unix://{CRICTL_SOCK}", "rmi", "--prune")
    lines = [line for line in (r.stdout or "").splitlines() if "DeadlineExceeded" not in line]
    for line in lines[-5:]:
        log(f"  {line}")
else:
    log("crictl skipped: socket not ready")

# ── 5. journald ──────────────────────────────────────────────────────────────
log("journalctl: vacuum to 14 days / 100MB...")
run_tail(5, "journalctl", "--vacuum-time=14d", "--vacuum-size=100M")

# ── 6. Container logs ────────────────────────────────────────────────────────
log("Pod logs: removing entries older than 3 days...")
pods_log = Path("/var/log/pods")
if pods_log.is_dir():
    for f in pods_log.rglob("*.log*"):
        try:
            age = now - f.stat().st_mtime
            if ".log" in f.name and age > 3 * DAY:
                f.unlink(missing_ok=True)
            elif f.name.endswith(".log") and age > DAY and f.stat().st_size > 10 * 1024 * 1024:
                with f.open("r+b") as fh:
                    fh.truncate(1024 * 1024)
        except OSError:
            pass

# ── 7. apt cache ─────────────────────────────────────────────────────────────
log("apt: cleaning cache...")
run("apt-get", "clean")

# ── 8. VS Code Server — keep newest 2 versions ───────────────────────────────
for d in (
    Path("/home/tbaltzakis/.vscode-server/cli/servers"),
    Path("/home/tbaltzakis/.vscode-server-insiders/cli/servers"),
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

# ── 9. npm cache ──────────────────────────────────────────────────────────────
log("npm: cleaning user + root cache...")
run_tail(2, "su", "-s", "/bin/bash", "-c", "npm cache clean --force", "tbaltzakis")
run_tail(2, "npm", "cache", "clean", "--force")

# ── 10. cloudless-releases — keep last 3 SHAs ────────────────────────────────
releases_dir = Path("/home/tbaltzakis/cloudless-releases")
if releases_dir.is_dir():
    log("cloudless-releases: pruning old SHAs (keep 3)...")
    for f in releases_dir.glob(".merge-*"):
        if f.is_dir():
            shutil.rmtree(f, ignore_errors=True)

    standalone = Path("/home/tbaltzakis/cloudless-standalone")
    current_sha = os.path.basename(os.readlink(standalone)) if standalone.is_symlink() else ""

    shas = sorted(
        (p for p in releases_dir.iterdir() if p.is_dir() and p.name != current_sha),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for old in shas[2:]:
        log(f"  removing old release: {old.name}")
        shutil.rmtree(old, ignore_errors=True)

# ── 11. cloudless.gr repo build artifacts ────────────────────────────────────
next_dir = Path("/home/tbaltzakis/cloudless.gr/.next")
if next_dir.is_dir():
    shutil.rmtree(next_dir, ignore_errors=True)
node_modules = Path("/home/tbaltzakis/cloudless.gr/node_modules")
if node_modules.is_dir():
    try:
        if now - node_modules.stat().st_atime > 7 * DAY:
            shutil.rmtree(node_modules, ignore_errors=True)
    except OSError:
        pass
for f in Path("/home/tbaltzakis").glob("cloudless-standalone.pre-symlink-*"):
    if f.is_dir():
        shutil.rmtree(f, ignore_errors=True)

# ── 12. Stale PR checkout dirs ────────────────────────────────────────────────
home = Path("/home/tbaltzakis")
for f in home.iterdir():
    if not f.is_dir():
        continue
    if re.match(r".*-pr(-.*)?$", f.name) or f.name.startswith("setup-pnpm"):
        try:
            if now - f.stat().st_mtime > 7 * DAY or f.name.startswith("setup-pnpm"):
                shutil.rmtree(f, ignore_errors=True)
        except OSError:
            pass

# ── 13. Stale /tmp files ─────────────────────────────────────────────────────
for f in Path("/tmp").iterdir():
    try:
        if f.is_file() and now - f.stat().st_mtime > 7 * DAY:
            f.unlink(missing_ok=True)
    except OSError:
        pass

# ── 14. Rotate the cleanup log itself ────────────────────────────────────────
if LOG.is_file() and LOG.stat().st_size >= 50 * 1024 * 1024:
    lines = LOG.read_text(errors="replace").splitlines()[-500:]
    LOG.write_text("\n".join(lines) + "\n")
    log("(log truncated to last 500 lines)")

after_root = df_avail("/")
log(f"freed on / : {(after_root - before_root) // 1024} MB")
log("=== Cleanup done (omv-main) ===")
