#!/usr/bin/env python3
"""Install host-side exporters for Tailscale + bind cloudflared metrics.

Port of install.sh.
Run on omv (fans out to omv-ha) or on each host with LOCAL_ONLY=1.

Usage: python3 install.py
"""

import os
import socket
import subprocess
import sys
from pathlib import Path

SSH_USER = os.environ.get("SSH_USER", "tbaltzakis")
OMV = os.environ.get("OMV_HOST", "192.168.1.128")
HA = os.environ.get("HA_HOST", "192.168.1.130")
LOCAL_ONLY = os.environ.get("LOCAL_ONLY", "0") == "1"
SCRIPT_DIR = Path(__file__).resolve().parent
SSH_OPTS = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=10"]

REMOTE_STEPS = """\
set -euo pipefail
sudo install -m 0755 /tmp/tailscale-metrics-exporter.py /usr/local/lib/cloudless/tailscale-metrics-exporter.py
sudo install -m 0644 /tmp/tailscale-metrics-exporter.service /etc/systemd/system/tailscale-metrics-exporter.service
sudo install -m 0644 /tmp/cloudflared-metrics.conf /etc/systemd/system/cloudflared.service.d/metrics.conf
sudo systemctl daemon-reload
sudo systemctl enable --now tailscale-metrics-exporter.service
sudo systemctl restart cloudflared.service
sleep 2
systemctl is-active tailscale-metrics-exporter
systemctl is-active cloudflared
curl -sS -o /dev/null -w "tailscale-metrics:%{http_code}\\n" --max-time 3 http://127.0.0.1:9102/metrics
curl -sS -o /dev/null -w "cloudflared-metrics:%{http_code}\\n" --max-time 3 http://127.0.0.1:20241/metrics
# confirm LAN bind (not only loopback)
ss -ltn | grep -E ':9102|:20241' || true
"""


def install_on(host: str) -> None:
    print(f"==> Installing fabric metrics on {host}")
    target = f"{SSH_USER}@{host}"
    subprocess.run(
        ["ssh", *SSH_OPTS, target,
         "sudo mkdir -p /usr/local/lib/cloudless /etc/systemd/system/cloudflared.service.d"],
        check=True,
    )
    for f in ("tailscale-metrics-exporter.py",
              "tailscale-metrics-exporter.service",
              "cloudflared-metrics.conf"):
        subprocess.run(
            ["scp", *SSH_OPTS, str(SCRIPT_DIR / f), f"{target}:/tmp/{f}"],
            check=True,
        )
    subprocess.run(["ssh", *SSH_OPTS, target, "bash", "-s"], input=REMOTE_STEPS.encode(), check=True)


def run(*args: str) -> None:
    subprocess.run(list(args), check=True)


if LOCAL_ONLY:
    host = socket.gethostname().split(".")[0]
    print(f"LOCAL_ONLY=1 — installing on this host ({host})")
    run("sudo", "mkdir", "-p", "/usr/local/lib/cloudless", "/etc/systemd/system/cloudflared.service.d")
    run("sudo", "install", "-m", "0755", str(SCRIPT_DIR / "tailscale-metrics-exporter.py"),
        "/usr/local/lib/cloudless/tailscale-metrics-exporter.py")
    run("sudo", "install", "-m", "0644", str(SCRIPT_DIR / "tailscale-metrics-exporter.service"),
        "/etc/systemd/system/tailscale-metrics-exporter.service")
    run("sudo", "install", "-m", "0644", str(SCRIPT_DIR / "cloudflared-metrics.conf"),
        "/etc/systemd/system/cloudflared.service.d/metrics.conf")
    run("sudo", "systemctl", "daemon-reload")
    run("sudo", "systemctl", "enable", "--now", "tailscale-metrics-exporter.service")
    run("sudo", "systemctl", "restart", "cloudflared.service")
    sys.exit(0)

install_on(OMV)
install_on(HA)
print("==> Host fabric metrics installed on omv + omv-ha")
