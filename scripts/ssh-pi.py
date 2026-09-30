#!/usr/bin/env python3
"""ssh-pi.py — SSH to omv / omv-ha preferring Tailscale, falling
back to LAN.

Usage:
  scripts/ssh-pi.py omv 'hostname'
  scripts/ssh-pi.py omv-ha
  scripts/ssh-pi.py github-omv uptime"""

import os
import subprocess
import sys

HOSTS = {
    "omv": ("100.74.191.58", "192.168.1.128"),
    "github-omv": ("100.74.191.58", "192.168.1.128"),
    "omv-ha": ("100.95.117.84", "192.168.1.130"),
    "ha": ("100.95.117.84", "192.168.1.130"),
}

if len(sys.argv) < 2:
    sys.exit(f"usage: {sys.argv[0]} omv|omv-ha|github-omv [remote-cmd...]")

target = sys.argv[1].lower()
if target not in HOSTS:
    sys.exit(f"unknown host: {target} (expected omv|omv-ha)")

ts_host, lan_host = HOSTS[target]
user = os.environ.get("PI_SSH_USER", "tbaltzakis")
identity = os.environ.get("PI_SSH_IDENTITY", os.path.expanduser("~/.ssh/id_rsa"))

ssh_base = [
    "ssh",
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "IdentitiesOnly=yes",
    "-i",
    identity,
    "-o",
    "ConnectTimeout=8",
]

remote_cmd = sys.argv[2:]

r = subprocess.run([*ssh_base, f"{user}@{ts_host}", "true"], capture_output=True)
host = ts_host if r.returncode == 0 else lan_host
if r.returncode != 0:
    print(f"[ssh-pi] Tailscale {ts_host} failed — trying LAN {lan_host}", file=sys.stderr)

os.execvp("ssh", [*ssh_base, f"{user}@{host}", *remote_cmd])
