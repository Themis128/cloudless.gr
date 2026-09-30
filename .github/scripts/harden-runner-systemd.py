#!/usr/bin/env python3
"""harden-runner-systemd.py <runner-name>

Port of harden-runner-systemd.sh.

Applies systemd drop-in hardening to a Pi GitHub Actions runner service:
  - Removes k3s.service dependency (After=/Requires=)
  - Adds Restart=on-failure + StartLimitIntervalSec=0
  - Sets After=network-online.target only
  - Configures fallback DNS

Usage:
  sudo python3 harden-runner-systemd.py omv
  sudo python3 harden-runner-systemd.py omv-2
  sudo python3 harden-runner-systemd.py omv-3

Must be run as root (or with sudo) on omv-main (192.168.1.128).
Idempotent — safe to re-run.
"""

import re
import subprocess
import sys
import time
from pathlib import Path

if len(sys.argv) < 2:
    print(f"Usage: {sys.argv[0]} <runner-name>  (e.g. omv, omv-2, omv-3)", file=sys.stderr)
    sys.exit(1)

RUNNER = sys.argv[1]
REPO = "Themis128-cloudless.gr"
SVC = f"actions.runner.{REPO}.{RUNNER}.service"
OVERRIDE_DIR = Path(f"/etc/systemd/system/{SVC}.d")

OVERRIDE_CONF = """\
[Unit]
# Decouple from k3s — runner must survive k3s crashes independently.
# Only wait for network to be online.
After=network-online.target
Wants=network-online.target

[Service]
Restart=on-failure
RestartSec=10s
# Never hit the start-rate limit — keep retrying after DNS flaps or crashes.
StartLimitIntervalSec=0
Environment="RUNNER_RETRY_RENEW_SECONDS=300"
Environment="DOTNET_SYSTEM_NET_HTTP_USESOCKETSHTTPHANDLER=1"
"""

DNS_CONF = """\
[Resolve]
DNS=8.8.8.8 8.8.4.4 1.1.1.1
FallbackDNS=9.9.9.9
"""


def systemctl(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["systemctl", *args], capture_output=True, text=True, check=False)


print(f"=== Hardening runner: {RUNNER} ({SVC}) ===")

# ── 1. Check for existing k3s dependency ──────────────────────────────────────
print("\n--- Current After= / Requires= ---")
r = systemctl("show", SVC, "--property=After", "--property=Requires")
print((r.stdout or "").strip() or "(service not found — may not be registered on this node)")

unit = systemctl("cat", SVC)
if re.search(r"k3s", unit.stdout, re.IGNORECASE):
    print("⚠️  k3s reference found in unit — will be excluded by override")
else:
    print("✓ No k3s dependency in base unit")

# ── 2. Write drop-in override ─────────────────────────────────────────────────
print("\n--- Writing override.conf ---")
OVERRIDE_DIR.mkdir(parents=True, exist_ok=True)
override_path = OVERRIDE_DIR / "override.conf"
override_path.write_text(OVERRIDE_CONF)
print(f"✓ Written {override_path}")
print(OVERRIDE_CONF, end="")

# ── 3. Configure fallback DNS ─────────────────────────────────────────────────
print("\n--- Configuring fallback DNS ---")
resolved_dir = Path("/etc/systemd/resolved.conf.d")
resolved_dir.mkdir(parents=True, exist_ok=True)
(resolved_dir / "retry.conf").write_text(DNS_CONF)
print("✓ Written /etc/systemd/resolved.conf.d/retry.conf")
systemctl("restart", "systemd-resolved")

# ── 4. Reload and restart ─────────────────────────────────────────────────────
print("\n--- Reloading systemd and restarting runner ---")
systemctl("daemon-reload")
r = systemctl("restart", SVC)
if r.returncode != 0:
    print("⚠️  Restart failed — service may need registration first", file=sys.stderr)
    sys.exit(1)
time.sleep(5)

# ── 5. Verify ─────────────────────────────────────────────────────────────────
print("\n--- Post-hardening verification ---")
status = systemctl("is-active", SVC).stdout.strip() or "unknown"
print(f"Service status: {status}")

after = systemctl("show", SVC, "--property=After").stdout.strip()
print(f"After= : {after}")

if re.search(r"k3s", after, re.IGNORECASE):
    print("⚠️  WARNING: k3s still appears in After= — check override", file=sys.stderr)
else:
    print("✓ No k3s dependency in effective unit")

if status == "active":
    print(f"\n✅ Runner {RUNNER} is hardened and active.")
else:
    print(
        f"\n❌ Runner {RUNNER} is not active (status: {status}). Check: journalctl -u {SVC} -n 30"
    )
    sys.exit(1)
