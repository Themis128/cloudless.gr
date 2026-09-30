#!/usr/bin/env python3
"""pi-connectivity-heal.py — keep Tailscale + classic OpenSSH reachable on a Pi.

Port of pi-connectivity-heal.sh.

Problem modes this addresses:
  1. tailscaled dead / logged out → no MagicDNS / no 100.x path
  2. Tailscale SSH (RunSSH) re-enabled → interactive "check" breaks BatchMode
  3. sshd down or not listening on :22 → LAN + TS SSH fail
  4. After reboot, services need a nudge once network is up

Policy: classic OpenSSH owns port 22. Tailscale provides the mesh only
(`tailscale set --ssh=false`). Do not re-enable Tailscale SSH on these hosts.

Usage (root):
  pi-connectivity-heal.py --boot|--check
"""

import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

MODE = sys.argv[1] if len(sys.argv) > 1 else "--check"
LOG_TAG = "pi-connectivity-heal"
PEER_TS_IPS_DEFAULT = "100.74.191.58 100.95.117.84"


def log(msg: str) -> None:
    print(f"[{LOG_TAG}] {msg}")
    subprocess.run(["logger", "-t", LOG_TAG, msg], check=False, capture_output=True)


def run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(args), capture_output=True, text=True, check=False)


def have(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def ensure_sshd() -> int:
    unit = ""
    if run("systemctl", "cat", "ssh.service").returncode == 0:
        unit = "ssh.service"
    elif run("systemctl", "list-unit-files", "sshd.service").returncode == 0:
        unit = "sshd.service"
    if not unit:
        log("WARN: no ssh/sshd unit found")
        return 1
    run("systemctl", "enable", unit)
    if run("systemctl", "is-active", "--quiet", unit).returncode != 0:
        log(f"starting {unit}")
        if run("systemctl", "start", unit).returncode != 0:
            log(f"WARN: start {unit} failed")
    # Must listen on :22 (all interfaces — includes Tailscale)
    listening = re.search(r":22\s", run("ss", "-ltn").stdout or "")
    if not listening:
        log(f"sshd not listening on :22 — restarting {unit}")
        run("systemctl", "restart", unit)
        time.sleep(1)
    if re.search(r":22\s", run("ss", "-ltn").stdout or ""):
        log("sshd listening on :22")
        return 0
    log("ERROR: sshd still not on :22")
    return 1


def tailscale_state() -> str:
    r = run("tailscale", "status", "--json")
    try:
        return json.loads(r.stdout).get("BackendState") or ""
    except (json.JSONDecodeError, AttributeError):
        return ""


def ensure_tailscale() -> int:
    if not have("tailscale") or not have("tailscaled"):
        log("WARN: tailscale not installed")
        return 1
    run("systemctl", "enable", "tailscaled")
    if run("systemctl", "is-active", "--quiet", "tailscaled").returncode != 0:
        log("starting tailscaled")
        if run("systemctl", "start", "tailscaled").returncode != 0:
            log("WARN: start tailscaled failed")
        time.sleep(2)

    # Classic SSH only — Tailscale SSH "check" breaks automation / BatchMode.
    prefs = run("tailscale", "debug", "prefs").stdout or ""
    run_ssh = next((line for line in prefs.splitlines() if '"RunSSH"' in line), "")
    if "true" in run_ssh:
        log("disabling Tailscale SSH (RunSSH=true → false)")
        if run("tailscale", "set", "--ssh=false").returncode != 0:
            log("WARN: tailscale set --ssh=false failed")

    # Backend state
    state = tailscale_state()
    if state != "Running":
        log(f"tailscale BackendState={state or 'unknown'} — restarting tailscaled")
        run("systemctl", "restart", "tailscaled")
        time.sleep(5)
        # Best-effort re-auth if a reusable key file exists (operator-managed).
        key_file = Path("/etc/cloudless/tailscale-authkey")
        if key_file.is_file():
            key = key_file.read_text().strip()
            if key:
                log("tailscale up with /etc/cloudless/tailscale-authkey")
                r = run(
                    "tailscale", "up", f"--auth-key={key}",
                    "--ssh=false", "--accept-routes", "--reset=false",
                )
                if r.returncode != 0:
                    log("WARN: tailscale up failed")

    ip = run("tailscale", "ip", "-4").stdout.strip()
    if not ip:
        log("ERROR: no Tailscale IPv4")
        return 1
    log(f"tailscale ok ip={ip} state={tailscale_state() or '?'}")
    return 0


def ping_peers() -> int:
    import os
    peers = os.environ.get("PI_CONNECTIVITY_PEERS", PEER_TS_IPS_DEFAULT).split()
    self_ip = run("tailscale", "ip", "-4").stdout.strip()
    for peer in peers:
        if not peer or peer == self_ip:
            continue
        if run("tailscale", "ping", "-c", "1", "-timeout", "3s", peer).returncode == 0:
            log(f"peer {peer} reachable")
        else:
            log(f"WARN: peer {peer} unreachable via tailscale ping")
    return 0


if MODE == "--boot":
    log("boot heal")
    time.sleep(8)
    ensure_tailscale()
    ensure_sshd()
    ping_peers()
elif MODE == "--check":
    ensure_tailscale()
    ensure_sshd()
    ping_peers()
else:
    print(f"Usage: {sys.argv[0]} --boot|--check", file=sys.stderr)
    sys.exit(2)
