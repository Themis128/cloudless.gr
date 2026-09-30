#!/usr/bin/env python3
"""Run Tailscale diagnostics on Pi nodes via SSH."""

import subprocess
import sys
from pathlib import Path

OMV_USER = "tbaltzakis"
OMV_HOST = "192.168.1.128"
OMV_HA_HOST = "192.168.1.130"
SSH_PASSWORD = "themis"

ROOT = Path(__file__).resolve().parent.parent
DIAGNOSE = ROOT / "scripts" / "tailscale-diagnose.py"


def run_ssh(host: str, cmd: str, stdin_file=None) -> None:
    print(f"Running on {host}: {cmd}")
    subprocess.run(
        [
            "sshpass",
            "-p",
            SSH_PASSWORD,
            "ssh",
            "-o",
            "StrictHostKeyChecking=no",
            f"{OMV_USER}@{host}",
            cmd,
        ],
        stdin=stdin_file,
    )


print("=== Running diagnostics on omv node ===")
with open(DIAGNOSE if DIAGNOSE.exists() else ROOT / "scripts/tailscale-diagnose.sh") as f:
    run_ssh(OMV_HOST, "bash -s" if DIAGNOSE.suffix == ".sh" else "python3 -", f)

print("=== Running diagnostics on omv-ha node ===")
with open(DIAGNOSE if DIAGNOSE.exists() else ROOT / "scripts/tailscale-diagnose.sh") as f:
    run_ssh(OMV_HA_HOST, "bash -s" if DIAGNOSE.suffix == ".sh" else "python3 -", f)

print("=== Checking Tailscale status ===")
run_ssh(OMV_HOST, "tailscale status")

print("=== Checking Tailscale ping ===")
run_ssh(OMV_HOST, "ping -c 3 100.110.250.58")

print("=== Checking Tailscale service ===")
run_ssh(OMV_HOST, "systemctl status tailscale")

print("=== Checking firewall rules ===")
run_ssh(OMV_HOST, "sudo iptables -L -n -v")

print("Diagnostics complete. Check the output for any issues.")
sys.exit(0)
