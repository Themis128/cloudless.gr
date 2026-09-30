#!/usr/bin/env python3
"""install-pi-connectivity-heal.py — install connectivity heal + sshd priority drop-in.

Port of install-pi-connectivity-heal.sh.

Run as root on omv or omv-ha:
  sudo python3 infrastructure/omv/install-pi-connectivity-heal.py
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
SCRIPT = REPO_DIR / "pi-connectivity-heal.py"
BOOT_SVC = REPO_DIR / "pi-connectivity-heal.service"
CHECK_SVC = REPO_DIR / "pi-connectivity-heal-check.service"
TIMER = REPO_DIR / "pi-connectivity-heal.timer"
SSHD_DROPIN_SRC = REPO_DIR / "sshd-under-load.conf"

for f in (SCRIPT, BOOT_SVC, CHECK_SVC, TIMER):
    if not f.is_file():
        print(f"missing: {f}", file=sys.stderr)
        sys.exit(1)


def install(src: Path, mode: int, dest: str) -> None:
    subprocess.run(
        ["install", "-m", str(mode), "-o", "root", "-g", "root", str(src), dest],
        check=True,
    )


install(SCRIPT, 755, "/usr/local/sbin/pi-connectivity-heal.py")
install(BOOT_SVC, 644, "/etc/systemd/system/pi-connectivity-heal.service")
install(CHECK_SVC, 644, "/etc/systemd/system/pi-connectivity-heal-check.service")
install(TIMER, 644, "/etc/systemd/system/pi-connectivity-heal.timer")

# Compat wrapper — remote callers still invoke /usr/local/sbin/pi-connectivity-heal.sh
Path("/usr/local/sbin/pi-connectivity-heal.sh").write_text(
    '#!/bin/sh\nexec python3 /usr/local/sbin/pi-connectivity-heal.py "$@"\n'
)
os.chmod("/usr/local/sbin/pi-connectivity-heal.sh", 0o755)

# Keep OpenSSH responsive when next-build pegs the Pi CPU.
if SSHD_DROPIN_SRC.is_file():
    for d in ("/etc/systemd/system/ssh.service.d", "/etc/systemd/system/sshd.service.d"):
        Path(d).mkdir(parents=True, exist_ok=True)
    install(SSHD_DROPIN_SRC, 644, "/etc/systemd/system/ssh.service.d/under-load.conf")
    install(SSHD_DROPIN_SRC, 644, "/etc/systemd/system/sshd.service.d/under-load.conf")

sshd_conn = REPO_DIR / "sshd-connectivity.conf"
if sshd_conn.is_file():
    install(sshd_conn, 644, "/etc/ssh/sshd_config.d/99-cloudless-connectivity.conf")

# Hardened tailscaled restart policy
Path("/etc/systemd/system/tailscaled.service.d").mkdir(parents=True, exist_ok=True)
Path("/etc/systemd/system/tailscaled.service.d/restart.conf").write_text(
    "[Service]\nRestart=always\nRestartSec=5s\nStartLimitIntervalSec=0\n"
)

# Policy: classic SSH only
if shutil.which("tailscale"):
    subprocess.run(["tailscale", "set", "--ssh=false"], check=False)


def systemctl(*args: str) -> None:
    subprocess.run(["systemctl", *args], check=False)


systemctl("daemon-reload")
# Reload sshd config if possible
if subprocess.run(["systemctl", "try-reload-or-restart", "ssh.service"], capture_output=True, check=False).returncode != 0:
    subprocess.run(["systemctl", "try-reload-or-restart", "sshd.service"], capture_output=True, check=False)

systemctl("enable", "pi-connectivity-heal.service")
systemctl("enable", "--now", "pi-connectivity-heal.timer")
systemctl("start", "pi-connectivity-heal-check.service")

print("[install] pi-connectivity-heal enabled")
systemctl("--no-pager", "status", "pi-connectivity-heal.timer")
subprocess.run(["/usr/local/sbin/pi-connectivity-heal.py", "--check"], check=False)
print("[install] done — journalctl -t pi-connectivity-heal -n 40")
