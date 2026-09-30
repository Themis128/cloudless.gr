#!/usr/bin/env python3
"""restore-pi-connectivity.py — operator remedy when Pi SSH / Tailscale
breaks.

Tries Tailscale then LAN for omv + omv-ha, runs on-box heal, forces
classic OpenSSH (tailscale set --ssh=false), restarts
sshd/tailscaled/runners, and prints a reachability matrix.

Usage:
  python3 scripts/restore-pi-connectivity.py
  PI_SSH_IDENTITY=~/.ssh/id_rsa python3
      scripts/restore-pi-connectivity.py

When this host cannot reach the Pis at all, use GitHub Actions instead:
  gh workflow run restore-pi-connectivity.yml"""

import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

USER_NAME = os.environ.get("PI_SSH_USER", "tbaltzakis")
IDENTITY = os.environ.get("PI_SSH_IDENTITY", str(Path.home() / ".ssh/id_rsa"))
CONNECT_TIMEOUT = os.environ.get("PI_SSH_TIMEOUT", "12")

TS_IP = {"omv": "100.74.191.58", "omv-ha": "100.95.117.84"}
LAN_IP = {"omv": "192.168.1.128", "omv-ha": "192.168.1.130"}

SSH_OPTS = [
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "IdentitiesOnly=yes",
    "-o",
    f"ConnectTimeout={CONNECT_TIMEOUT}",
    "-o",
    "ServerAliveInterval=10",
    "-o",
    "ServerAliveCountMax=2",
]
if Path(IDENTITY).is_file():
    SSH_OPTS += ["-i", IDENTITY]


def log(msg: str) -> None:
    print(f"[restore] {msg}")


def ssh_to(host: str, *args: str, stdin: str = "") -> int:
    return subprocess.call(
        ["ssh", *SSH_OPTS, f"{USER_NAME}@{host}", *args], input=stdin if stdin else None, text=True
    )


def reachable(host: str) -> bool:
    return (
        subprocess.run(
            ["ssh", *SSH_OPTS, f"{USER_NAME}@{host}", "true"], capture_output=True
        ).returncode
        == 0
    )


def pick_addr(node: str) -> str | None:
    for ip in (TS_IP[node], LAN_IP[node]):
        if reachable(ip):
            return ip
    return None


REMOTE_RESTORE = """\
set -euo pipefail
echo "=== host=$(hostname) ==="
if [ -x /usr/local/sbin/pi-connectivity-heal.sh ]; then
  sudo /usr/local/sbin/pi-connectivity-heal.sh --boot || sudo /usr/local/sbin/pi-connectivity-heal.sh --check || true
else
  sudo systemctl restart tailscaled || true
  sleep 4
  sudo tailscale set --ssh=false || true
  sudo systemctl restart ssh 2>/dev/null || sudo systemctl restart sshd 2>/dev/null || true
fi
sudo tailscale set --ssh=false || true
if [ -x /usr/local/sbin/gha-runner-heal.sh ]; then
  sudo /usr/local/sbin/gha-runner-heal.sh --boot || sudo /usr/local/sbin/gha-runner-heal.sh --check || true
else
  for u in $(systemctl list-units --type=service --all --no-legend 'actions.runner.*' 2>/dev/null | awk '{print $1}'); do
    sudo systemctl restart "$u" || true
  done
fi
if [ -f /tmp/configure-pi-firewall.sh ]; then
  sudo bash /tmp/configure-pi-firewall.sh || true
elif [ -f "$HOME/cloudless.gr/infrastructure/omv/configure-pi-firewall.sh" ]; then
  sudo bash "$HOME/cloudless.gr/infrastructure/omv/configure-pi-firewall.sh" || true
fi
echo "--- status ---"
systemctl is-active ssh sshd tailscaled 2>/dev/null || true
tailscale ip -4 2>/dev/null || true
tailscale debug prefs 2>/dev/null | grep RunSSH || true
ss -ltn 2>/dev/null | grep ':22 ' || true
"""

JUMP = """\
set -euo pipefail
KEY=""
if [ -f "$HOME/.ssh/omv_ha" ]; then KEY="-i $HOME/.ssh/omv_ha"; fi
ssh $KEY -o BatchMode=yes -o ConnectTimeout=25 -o StrictHostKeyChecking=accept-new \\
  tbaltzakis@192.168.1.128 bash -s <<'EOS'
set -euo pipefail
if [ -x /usr/local/sbin/pi-connectivity-heal.sh ]; then
  sudo /usr/local/sbin/pi-connectivity-heal.sh --boot || true
fi
sudo tailscale set --ssh=false || true
sudo systemctl restart ssh 2>/dev/null || sudo systemctl restart sshd 2>/dev/null || true
if [ -x /usr/local/sbin/gha-runner-heal.sh ]; then
  sudo /usr/local/sbin/gha-runner-heal.sh --boot || true
fi
hostname; tailscale ip -4; systemctl is-active ssh tailscaled 2>/dev/null || true
EOS
"""


def restore_node(node: str) -> bool:
    addr = pick_addr(node)
    if not addr:
        log(f"FAIL {node} — unreachable on Tailscale ({TS_IP[node]}) and LAN ({LAN_IP[node]})")
        return False
    log(f"OK path {node} → {addr} — running restore")
    subprocess.call(
        ["ssh", *SSH_OPTS, f"{USER_NAME}@{addr}", "bash", "-s"], input=REMOTE_RESTORE, text=True
    )
    return True


def restore_omv_via_ha() -> bool:
    ha_addr = pick_addr("omv-ha")
    if not ha_addr:
        return False
    log(f"Trying omv restore via omv-ha jump ({ha_addr} → 192.168.1.128)")
    subprocess.call(
        ["ssh", *SSH_OPTS, f"{USER_NAME}@{ha_addr}", "bash", "-s"], input=JUMP, text=True
    )
    return True


log(f"Starting Pi connectivity restore ({datetime.now(UTC):%Y-%m-%dT%H:%MZ})")
rc = 0
if not restore_node("omv-ha"):
    rc = 1
if not restore_node("omv"):
    if not restore_omv_via_ha():
        rc = 1

print()
log("=== reachability matrix ===")
print(f"{'NODE':<10} {'Tailscale':<18} {'LAN':<18}")
for node in ("omv", "omv-ha"):
    ts_ok = "yes" if reachable(TS_IP[node]) else "no"
    lan_ok = "yes" if reachable(LAN_IP[node]) else "no"
    print(f"{node:<10} {ts_ok:<18} {lan_ok:<18}")
    if ts_ok != "yes" and lan_ok != "yes":
        rc = 1

if rc:
    log("Incomplete restore. From any network, dispatch:")
    log("  gh workflow run restore-pi-connectivity.yml")
    log("If the Pi is powered off, power-cycle it; heal runs on boot.")
    sys.exit(1)
log("Both nodes reachable. Done.")
