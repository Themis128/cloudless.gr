#!/usr/bin/env python3
"""install-gha-runner-heal.py — install boot + periodic runner heal on this host.

Port of install-gha-runner-heal.sh.

Run as root on omv or omv-ha:
  sudo python3 infrastructure/omv/install-gha-runner-heal.py
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
    subprocess.run(
        ["install", "-m", str(mode), "-o", "root", "-g", "root", str(src), dest],
        check=True,
    )


install(SCRIPT, 755, "/usr/local/sbin/gha-runner-heal.py")
install(BOOT_SVC, 644, "/etc/systemd/system/gha-runner-heal.service")
install(CHECK_SVC, 644, "/etc/systemd/system/gha-runner-heal-check.service")
install(TIMER, 644, "/etc/systemd/system/gha-runner-heal.timer")

# Compat wrapper — remote callers still invoke /usr/local/sbin/gha-runner-heal.sh
Path("/usr/local/sbin/gha-runner-heal.sh").write_text(
    '#!/bin/sh\nexec python3 /usr/local/sbin/gha-runner-heal.py "$@"\n'
)
os.chmod("/usr/local/sbin/gha-runner-heal.sh", 0o755)


def systemctl(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["systemctl", *args], capture_output=True, text=True, check=False)


systemctl("daemon-reload")
systemctl("enable", "gha-runner-heal.service")
systemctl("enable", "--now", "gha-runner-heal.timer")

# ---- Runner fast-start drop-in -------------------------------------------
# Replicate the 99-fast-start.conf fix (TimeoutStartSec=180 + clear
# ExecStartPre=) onto every GitHub actions.runner.*.service. Without it, a
# runner that also has 10-boot-delay's ExecStartPre=/bin/sleep 120 exceeds the
# 90s default TimeoutStartSec and enters an unbounded restart loop (start-pre
# timed out). Verify the source file exists before we reference it.
FAST_START = REPO_DIR / "99-fast-start.conf"
if FAST_START.is_file():
    r = systemctl("list-unit-files", "actions.runner.*.service", "--no-legend")
    for line in (r.stdout or "").splitlines():
        runit = line.split()[0] if line.split() else ""
        if not runit:
            continue
        drop = Path(f"/etc/systemd/system/{runit}.d")
        drop.mkdir(parents=True, exist_ok=True)
        install(FAST_START, 644, str(drop / "99-fast-start.conf"))
        print(f"[install] runner fast-start drop-in -> {runit}.d/99-fast-start.conf")

print("[install] enabled gha-runner-heal.service (boot) + gha-runner-heal.timer")
systemctl("start", "gha-runner-heal-check.service")
systemctl("--no-pager", "status", "gha-runner-heal.timer")
print("[install] done — check: journalctl -t gha-runner-heal -n 30")
