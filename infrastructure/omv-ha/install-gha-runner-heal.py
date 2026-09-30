#!/usr/bin/env python3
"""install-gha-runner-heal.py — install boot + periodic runner heal on this host.

Port of install-gha-runner-heal.sh.

Run as root on omv or omv-ha:
  sudo python3 infrastructure/omv-ha/install-gha-runner-heal.py
Or from a checkout on the Pi:
  sudo python3 /path/to/install-gha-runner-heal.py
"""

import os
import subprocess
import sys
from pathlib import Path

if os.geteuid() != 0:
    print("must be root", file=sys.stderr)
    sys.exit(1)

REPO_DIR = Path(__file__).resolve().parent
SCRIPT = REPO_DIR / "gha-runner-heal.py"
BOOT_SVC = REPO_DIR / "gha-runner-heal.service"
CHECK_SVC = REPO_DIR / "gha-runner-heal-check.service"
TIMER = REPO_DIR / "gha-runner-heal.timer"

for f in (SCRIPT, BOOT_SVC, CHECK_SVC, TIMER):
    if not f.is_file():
        print(f"missing: {f}", file=sys.stderr)
        sys.exit(1)


def install(src: Path, mode: int, dest: str) -> None:
    subprocess.run(["install", "-m", str(mode), "-o", "root", "-g", "root", str(src), dest], check=True)


install(SCRIPT, 755, "/usr/local/sbin/gha-runner-heal.py")
# Compat wrapper for callers that still invoke the .sh path
Path("/usr/local/sbin/gha-runner-heal.sh").write_text(
    '#!/bin/sh\nexec python3 /usr/local/sbin/gha-runner-heal.py "$@"\n'
)
os.chmod("/usr/local/sbin/gha-runner-heal.sh", 0o755)
install(BOOT_SVC, 644, "/etc/systemd/system/gha-runner-heal.service")
install(CHECK_SVC, 644, "/etc/systemd/system/gha-runner-heal-check.service")
install(TIMER, 644, "/etc/systemd/system/gha-runner-heal.timer")

subprocess.run(["systemctl", "daemon-reload"], check=True)
subprocess.run(["systemctl", "enable", "gha-runner-heal.service"], check=True)
subprocess.run(["systemctl", "enable", "--now", "gha-runner-heal.timer"], check=True)

print("[install] enabled gha-runner-heal.service (boot) + gha-runner-heal.timer")
subprocess.run(["systemctl", "start", "gha-runner-heal-check.service"], check=False)
subprocess.run(["systemctl", "--no-pager", "status", "gha-runner-heal.timer"], check=False)
print("[install] done — check: journalctl -t gha-runner-heal -n 30")
