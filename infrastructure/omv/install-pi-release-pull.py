#!/usr/bin/env python3
"""install-pi-release-pull.py — install load-guarded R2 pull agent on omv.

Port of install-pi-release-pull.sh.
Run as root on omv (or: ssh omv "sudo python3 -" < this-script).

Requires /etc/cloudless/pi-release-pull.env already populated (see
infrastructure/omv/pi-release-pull.env.example). Does not write secrets.
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

if os.geteuid() != 0:
    print("must be root", file=sys.stderr)
    sys.exit(1)

REPO_DIR = Path(__file__).resolve().parent


def install(src: Path, mode: int, dest: str) -> None:
    subprocess.run(
        ["install", "-m", str(mode), str(src), dest],
        check=True,
    )


subprocess.run(["install", "-d", "-m", "755", "/usr/local/sbin"], check=True)
install(REPO_DIR / "pi-release-pull.py", 755, "/usr/local/sbin/pi-release-pull.py")
install(REPO_DIR / "pi-release-pull.service", 644, "/etc/systemd/system/pi-release-pull.service")
install(REPO_DIR / "pi-release-pull.timer", 644, "/etc/systemd/system/pi-release-pull.timer")
subprocess.run(["install", "-d", "-m", "700", "/etc/cloudless"], check=True)

# Compat wrapper for callers that still invoke the .sh path
Path("/usr/local/sbin/pi-release-pull.sh").write_text(
    '#!/bin/sh\nexec python3 /usr/local/sbin/pi-release-pull.py "$@"\n'
)
os.chmod("/usr/local/sbin/pi-release-pull.sh", 0o755)

if not Path("/etc/cloudless/pi-release-pull.env").is_file():
    print("NOTE: create /etc/cloudless/pi-release-pull.env from pi-release-pull.env.example")

# rclone for the R2 S3 fallback download path
if not shutil.which("rclone"):
    print("WARNING: rclone not found — install it for the R2 S3 fallback download path")


def systemctl(*args: str) -> None:
    subprocess.run(["systemctl", *args], check=False)


systemctl("daemon-reload")
systemctl("enable", "--now", "pi-release-pull.timer")
systemctl("start", "pi-release-pull.service")
r = subprocess.run(
    ["systemctl", "status", "pi-release-pull.timer", "--no-pager"],
    capture_output=True,
    text=True,
    check=False,
)
print("\n".join((r.stdout or "").splitlines()[:15]))
print("installed. logs: journalctl -t pi-release-pull -f")
