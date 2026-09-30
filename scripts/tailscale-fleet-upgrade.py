#!/usr/bin/env python3
"""Remediates Tailscale on managed Linux hosts and upgrades to latest
stable.

Runs on a host that can reach the Pis over LAN (omv runner) or already
on the tailnet. Does NOT touch Windows office nodes (manual).

Env:
  DRY_RUN=1    — print plan only
  FIX=1        — restart inactive tailscaled / bring node back
  UPGRADE=1    — apt upgrade tailscale to candidate (= latest stable)
  FORCE_APT=1  — apt even when already on latest
  SSH_USER     — default tbaltzakis

Usage:
  FIX=1 UPGRADE=1 python3 scripts/tailscale-fleet-upgrade.py"""

import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request

DRY_RUN = os.environ.get("DRY_RUN", "0").lower() in ("1", "true", "yes")
FIX = os.environ.get("FIX", "0").lower() in ("1", "true", "yes")
UPGRADE = os.environ.get("UPGRADE", "0").lower() in ("1", "true", "yes")
FORCE_APT = os.environ.get("FORCE_APT", "0").lower() in ("1", "true")
SSH_USER = os.environ.get("SSH_USER", "tbaltzakis")
SSH_OPTS = [
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "ConnectTimeout=10",
]

# name|lan_ip|tailnet_ip
HOSTS = [
    ("github-omv", "192.168.1.128", "100.74.191.58"),
    ("omv-ha", "192.168.1.130", "100.95.117.84"),
]

for tool in ("ssh",):
    if not shutil.which(tool):
        print(f"missing {tool}", file=sys.stderr)
        sys.exit(1)

pkgs = json.loads(
    urllib.request.urlopen("https://pkgs.tailscale.com/stable/?mode=json", timeout=30).read()
)
LATEST = pkgs.get("TarballsVersion", "")
if not LATEST:
    print("Could not resolve latest Tailscale version", file=sys.stderr)
    sys.exit(1)
print(f"==> Latest stable: {LATEST}")
print(f"==> DRY_RUN={int(DRY_RUN)} FIX={int(FIX)} UPGRADE={int(UPGRADE)}")


def ssh_try(host: str, script: str) -> tuple[int, str]:
    r = subprocess.run(
        ["ssh", *SSH_OPTS, f"{SSH_USER}@{host}", "bash", "-s"],
        input=script,
        capture_output=True,
        text=True,
        timeout=120,
    )
    return r.returncode, r.stdout + r.stderr


def reachable(host: str) -> bool:
    return (
        subprocess.run(
            ["ssh", *SSH_OPTS, f"{SSH_USER}@{host}", "true"], capture_output=True, timeout=15
        ).returncode
        == 0
    )


def pick_endpoint(lan: str, ts: str) -> str | None:
    for ep in (lan, ts):
        if reachable(ep):
            return ep
    return None


REMOTE_STATUS = """\
set -euo pipefail
HOST=$(hostname 2>/dev/null || echo unknown)
ACTIVE=$(systemctl is-active tailscaled 2>/dev/null || echo inactive)
VER=$(tailscale version 2>/dev/null | head -1 || echo unknown)
BACKEND=$(tailscale status --self --json 2>/dev/null | \
  python3 -c 'import json,sys
try:
  d=json.load(sys.stdin); print(d.get("BackendState") or "")
except Exception:
  print("")' 2>/dev/null || true)
printf 'host=%s active=%s version=%s backend=%s\\n' "$HOST" "$ACTIVE" "$VER" "${BACKEND:-unknown}"
"""

REMOTE_FIX = """\
set -euo pipefail
sudo systemctl enable --now tailscaled
sudo systemctl restart tailscaled
sleep 4
sudo tailscale set --ssh=false 2>/dev/null || true
systemctl is-active tailscaled
tailscale status --self 2>/dev/null | head -2 || true
"""

REMOTE_UPGRADE = """\
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
if [[ ! -f /etc/apt/sources.list.d/tailscale.list ]] && \\
   [[ ! -f /usr/share/keyrings/tailscale-archive-keyring.gpg ]]; then
  curl -fsSL https://tailscale.com/install.sh | sudo sh
fi
sudo apt-get update -qq
BEFORE=$(tailscale version 2>/dev/null | head -1 || echo none)
sudo apt-get install -y -qq --only-upgrade tailscale tailscaled || \\
  sudo apt-get install -y -qq tailscale
AFTER=$(tailscale version 2>/dev/null | head -1 || echo none)
echo "before=$BEFORE"
echo "after=$AFTER"
ACTIVE=$(systemctl is-active tailscaled 2>/dev/null || echo inactive)
if [[ "$BEFORE" != "$AFTER" || "$ACTIVE" != "active" ]]; then
  sudo systemctl restart tailscaled
  sleep 4
  sudo tailscale set --ssh=false 2>/dev/null || true
fi
systemctl is-active tailscaled
tailscale version | head -3
"""


def field(status: str, key: str) -> str:
    m = re.search(rf"\b{key}=([^ ]+)", status)
    return m.group(1) if m else ""


FAIL = 0
for name, lan, ts in HOSTS:
    print(f"\n=== {name} (lan={lan} ts={ts}) ===")
    ep = pick_endpoint(lan, ts)
    if not ep:
        print("  UNREACHABLE over SSH (lan + tailnet)")
        FAIL = 1
        continue
    print(f"  endpoint={ep}")

    rc, status = ssh_try(ep, REMOTE_STATUS)
    status = status.strip().splitlines()[-1] if status.strip() else ""
    print(f"  {status}")
    active = field(status, "active")
    ver_base = field(status, "version").split("-")[0]

    if FIX and active != "active":
        print("  → fixing inactive tailscaled")
        if DRY_RUN:
            print(f"  [dry-run] would restart tailscaled on {ep}")
        else:
            rc, out = ssh_try(ep, REMOTE_FIX)
            print(out)
            if rc:
                FAIL = 1

    needs_upgrade = False
    if UPGRADE:
        if ver_base != LATEST:
            needs_upgrade = True
        elif FORCE_APT:
            needs_upgrade = True
        else:
            print(f"  already on {LATEST} — skip apt (set FORCE_APT=1 to refresh anyway)")

    if needs_upgrade:
        print(f"  → upgrading Tailscale (have {ver_base or 'unknown'}, want {LATEST})")
        if DRY_RUN:
            print(f"  [dry-run] would apt upgrade tailscale on {ep}")
        else:
            rc, out = ssh_try(ep, REMOTE_UPGRADE)
            print(out)
            if rc:
                FAIL = 1
        rc, status2 = ssh_try(ep, REMOTE_STATUS)
        status2 = status2.strip().splitlines()[-1] if status2.strip() else ""
        print(f"  post: {status2}")
        ver2_base = field(status2, "version").split("-")[0]
        if ver2_base and ver2_base != LATEST and not DRY_RUN:
            print(f"  ::warning::{name} still on {ver2_base} after upgrade (latest {LATEST})")
            FAIL = 1
    else:
        print("  ok (no upgrade requested)")

print()
if FAIL:
    print("::error::One or more managed hosts failed Tailscale remediate/upgrade")
    sys.exit(1)
print("==> Fleet remediate/upgrade complete")
