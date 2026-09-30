#!/usr/bin/env python3
"""k3s-watchdog-install.py — strengthen the k3s systemd service so it
auto-recovers from crashes without manual intervention.

  1. Writes a systemd drop-in: Restart=always + removes start limits
  2. Enables the k3s service for auto-start on boot
  3. Reloads systemd and confirms the active state

Idempotent — safe to re-run. Requires sudo (CI or directly on Pi)."""

import subprocess
from datetime import UTC, datetime
from pathlib import Path

OVERRIDE_DIR = Path("/etc/systemd/system/k3s.service.d")
OVERRIDE_FILE = OVERRIDE_DIR / "restart-always.conf"

DROP_IN = """\
[Service]
# Auto-restart k3s on any failure, indefinitely, with a 30s back-off.
# Removes the default start limit so k3s never stops retrying after N crashes.
Restart=always
RestartSec=30s
StartLimitBurst=0
StartLimitIntervalSec=0
"""


def sudo(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["sudo", *args], capture_output=True, text=True)


print(f"=== k3s watchdog install {datetime.now(UTC):%F %T}Z ===")

r = sudo("systemctl", "list-unit-files", "k3s.service")
found = "k3s.service" in r.stdout
if not found:
    r = sudo("systemctl", "list-units", "--full", "--all", "k3s.service")
    found = "k3s" in r.stdout
if not found:
    print("ERROR: k3s.service not found — is k3s installed on this host?")
    print("Tip: run 'which k3s' and 'sudo systemctl list-unit-files | grep k3s' to diagnose")
    raise SystemExit(1)

print("k3s.service found")

print(f"writing drop-in: {OVERRIDE_FILE}")
sudo("mkdir", "-p", str(OVERRIDE_DIR))
r = subprocess.run(
    ["sudo", "tee", str(OVERRIDE_FILE)], input=DROP_IN, capture_output=True, text=True
)
print("drop-in written:")
print(OVERRIDE_FILE.read_text() if OVERRIDE_FILE.exists() else DROP_IN)

sudo("systemctl", "daemon-reload")
print("daemon-reload: done")

r = sudo("systemctl", "enable", "k3s")
print(r.stdout.strip() or r.stderr.strip())
print("k3s: enabled for auto-start on boot")

print("\n=== k3s current state ===")
r = sudo("systemctl", "status", "k3s", "--no-pager")
print("\n".join((r.stdout + r.stderr).splitlines()[:20]))

print("\n=== effective restart config ===")
r = sudo(
    "systemctl",
    "show",
    "k3s",
    "--property=Restart,RestartSec,StartLimitBurst,StartLimitIntervalSec",
)
print(r.stdout.strip())

print("""
=== DONE ===
k3s will now restart automatically (Restart=always, RestartSec=30s, no start limit).
No further manual intervention needed after a k3s crash.""")
