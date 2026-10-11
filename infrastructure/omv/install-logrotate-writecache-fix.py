#!/usr/bin/env python3
"""install-logrotate-writecache-fix.py — omv: fix duplicate logrotate entries for rsyslog/ufw logs.

Root-cause fix for the recurring cron mail to root:

    error: rsyslog:1 duplicate log entry for /var/log/syslog
    error: rsyslog:1 duplicate log entry for /var/log/kern.log
    error: rsyslog:1 duplicate log entry for /var/log/user.log
    error: found error in file rsyslog, skipping
    error: ufw:1 duplicate log entry for /var/log/ufw.log
    error: found error in file ufw, skipping

  • /etc/logrotate.d/omv-writecache-logs (deployed 2026-10-10 for the
    pi-alert-remediation log + daemon.log cap) also claimed /var/log/syslog,
    kern.log, user.log and ufw.log.
  • The distro `rsyslog` and `ufw` packages ship their own configs for the
    same files, and logrotate refuses a log claimed by two stanzas — it
    errors and SKIPS that file entirely, so syslog/kern/user/ufw were never
    rotated while the duplicate existed.
  • Fix: keep only the logs unique to this file (daemon.log,
    pi-alert-remediation.log); the distro configs own the rest.

Usage (run as root on omv):
  sudo python3 install-logrotate-writecache-fix.py            # preview
  sudo python3 install-logrotate-writecache-fix.py --apply    # apply + verify

Applied live on omv 2026-10-10 (backup kept at /root/omv-writecache-logs.bak).
"""

import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

if os.geteuid() != 0:
    print("must be root", file=sys.stderr)
    sys.exit(1)

TARGET = Path("/etc/logrotate.d/omv-writecache-logs")
BACKUP_TS = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP_DIR = Path(os.environ.get("LOGROTATE_BACKUP_DIR", "/root"))
APPLY: bool = False  # set by main() from argv; tests patch it directly

# Logs that belong to THIS file (unique to it). syslog/kern.log/user.log are
# owned by the rsyslog package config, ufw.log by the ufw package config —
# claiming them here triggers logrotate's duplicate-entry error and makes it
# skip the rsyslog/ufw files completely.
FIXED_BODY = """\
/var/log/daemon.log /var/log/pi-alert-remediation.log {
\tmaxsize 40M
\trotate 2
\tcompress
\tmissingok
\tnotifempty
\tsharedscripts
\tpostrotate
\t\t/usr/lib/rsyslog/rsyslog-rotate
\tendscript
}
"""

DUPLICATE_CLAIMS = ("/var/log/syslog", "/var/log/kern.log", "/var/log/user.log", "/var/log/ufw.log")


def step(msg: str) -> None:
    print(f"\n== {msg} ==")


def main() -> int:
    global APPLY
    for a in sys.argv[1:]:
        if a != "--apply":
            print(f"unknown arg: {a}", file=sys.stderr)
            sys.exit(2)
    APPLY = "--apply" in sys.argv

    step(f"inspect {TARGET}")
    if not TARGET.exists():
        print("  file not present — nothing to fix")
        return 0
    current = TARGET.read_text()
    if not any(c in current for c in DUPLICATE_CLAIMS):
        print("  already fixed (no duplicate claims) — nothing to do")
        return 0

    for c in DUPLICATE_CLAIMS:
        if c in current:
            print(f"  duplicate claim found: {c}")

    step("rewrite with unique logs only (backup kept)")
    backup = BACKUP_DIR / f"{TARGET.name}.bak-{BACKUP_TS}"
    if APPLY:
        shutil.copy2(TARGET, backup)
        TARGET.write_text(FIXED_BODY)
        print(f"  wrote fixed config (backup: {backup})")
    else:
        print(f"  [preview] would back up to {backup} and rewrite with only:")
        print("  [preview]   /var/log/daemon.log /var/log/pi-alert-remediation.log")

    step("verify logrotate config")
    cmd = ["logrotate", "-d", "/etc/logrotate.conf"]
    out = subprocess.run(cmd, capture_output=True, text=True)
    dupes = [
        ln
        for ln in (out.stdout + out.stderr).splitlines()
        if "duplicate log entry" in ln or "found error in file" in ln
    ]
    if dupes:
        for ln in dupes[:5]:
            print(f"  STILL BROKEN: {ln}")
        if APPLY:
            return 1
        print("  [preview] errors expected until --apply")
    else:
        print("  no duplicate-entry errors — rsyslog/ufw rotate again")
    return 0


if __name__ == "__main__":
    sys.exit(main())
