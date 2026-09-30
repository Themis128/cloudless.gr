#!/usr/bin/env python3
"""rollback.py — instant rollback of the Pi-hosted cloudless.gr Next.js
app to any previously-deployed release, using the atomic-symlink layout
on omv (Pi 5).

LAYOUT ON omv:
  /home/tbaltzakis/cloudless-releases/<sha>/    ← each deploy writes here
  /home/tbaltzakis/cloudless-standalone         ← symlink to a release
  The k8s Deployment mounts cloudless-standalone via hostPath; flipping
  the symlink + rollout restart swaps versions in ~15s.

USAGE:
  rollback.py list              # show available releases (newest first)
  rollback.py previous          # flip to the release before current
  rollback.py <sha-prefix>      # flip to a specific release
  rollback.py --check           # show current live + linked SHAs

SAFETY: metadata-only — no rebuild, no destructive delete. Verifies
/api/health after the swap."""

import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

SSH_TARGET = os.environ.get("SSH_TARGET", "tbaltzakis@100.74.191.58")
KEY = os.environ.get("SSH_KEY", str(Path.home() / ".ssh/id_rsa"))
SSH = [
    "ssh",
    "-o",
    "StrictHostKeyChecking=no",
    "-o",
    "UserKnownHostsFile=/dev/null",
    "-o",
    "ConnectTimeout=10",
    "-i",
    KEY,
    SSH_TARGET,
]
BASE = "/home/tbaltzakis"
RELEASES = f"{BASE}/cloudless-releases"
CURRENT = f"{BASE}/cloudless-standalone"
NS = "cloudless"
DEPLOY = "cloudless-app"
SITE = os.environ.get("SITE", "https://cloudless.gr")


def log(m):
    print(f"\033[1m[rollback]\033[0m {m}")


def die(m):
    print(f"\033[31m[rollback] ERROR:\033[0m {m}", file=sys.stderr)
    sys.exit(1)


def remote(cmd: str, check: bool = False) -> str:
    r = subprocess.run([*SSH, cmd], capture_output=True, text=True)
    if check and r.returncode:
        die(f"remote command failed: {cmd}\n{r.stderr}")
    return r.stdout.strip()


def current_sha() -> str:
    return remote(f"readlink '{CURRENT}' 2>/dev/null | sed 's|^cloudless-releases/||'")


def list_releases() -> list[str]:
    return remote(f"ls -1t '{RELEASES}' 2>/dev/null").splitlines()


def live_version() -> str:
    try:
        return json.loads(urllib.request.urlopen(f"{SITE}/api/health", timeout=15).read()).get(
            "version", ""
        )
    except Exception:
        return ""


def do_check() -> None:
    cur = current_sha()
    live = live_version()
    log(f"linked on omv : {cur}")
    log(f"live version  : {live}")
    print()
    log("available releases (newest first):")
    for i, r in enumerate(list_releases(), 1):
        print(f"{i:4}  {r}")


def do_list() -> None:
    cur = current_sha()
    log(f"current linked: {cur}")
    print()
    for r in list_releases():
        print(f"  {'→' if r == cur else ' '}  {r}")


def flip_to(target: str) -> None:
    if not target:
        die("no target release given")
    r = subprocess.run([*SSH, f"test -d '{RELEASES}/{target}'"], capture_output=True)
    if r.returncode:
        die(f"release '{target}' does not exist on omv (list with 'scripts/rollback.py list')")
    cur = current_sha()
    if cur == target:
        log(f"already on {target} — nothing to do")
        return
    log(f"flipping symlink: {cur} → {target}")
    remote(
        f"sudo ln -sfn 'cloudless-releases/{target}' '{CURRENT}' "
        "&& sudo chown -h tbaltzakis:users "
        f"'{CURRENT}'",
        check=True,
    )
    log(f"restarting deploy/{DEPLOY} in ns {NS}…")
    out = remote(
        f"sudo k3s kubectl -n '{NS}' rollout restart deploy/{DEPLOY} "
        ">/dev/null && sudo k3s kubectl -n "
        f"'{NS}' rollout status deploy/{DEPLOY} --timeout=180s"
    )
    if out:
        print(out.splitlines()[-1])

    for _ in range(8):
        got = live_version()
        if got and target[:12] == got[:12]:
            log(f"✅ live version now: {got}")
            return
        time.sleep(4)
    die(
        f"rollout completed but /api/health didn't report the "
        f"expected version ({target}). Investigate."
    )


arg = sys.argv[1] if len(sys.argv) > 1 else ""
if arg in ("", "--help", "-h"):
    print(__doc__)
elif arg == "--check":
    do_check()
elif arg == "list":
    do_list()
elif arg == "previous":
    cur = current_sha()
    prev = next((r for r in list_releases() if r != cur), "")
    if not prev:
        die(f"no previous release available (only '{cur}' exists)")
    flip_to(prev)
else:
    target = next((r for r in list_releases() if r.startswith(arg)), "")
    if not target:
        die(f"no release matching prefix '{arg}' (list with 'scripts/rollback.py list')")
    flip_to(target)
