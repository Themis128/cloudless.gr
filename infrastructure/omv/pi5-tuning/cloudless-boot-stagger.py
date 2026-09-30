#!/usr/bin/env python3
"""cloudless-boot-stagger.py — after docker/k3s are up, pause mailcow briefly
then bring it back so the Pi 5 boot storm does not trip the HW watchdog.

Port of cloudless-boot-stagger.sh.

Usage: python3 cloudless-boot-stagger.py
"""

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

LOG_TAG = "cloudless-boot-stagger"


def log(msg: str) -> None:
    print(f"[{LOG_TAG}] {msg}")
    subprocess.run(["logger", "-t", LOG_TAG, msg], capture_output=True, check=False)


COMPOSE = os.environ.get("MAILCOW_COMPOSE", "/srv/mailcow/docker-compose.yml")
DELAY_SEC = int(os.environ.get("BOOT_STAGGER_DELAY_SEC", "180"))

# Mailbox SoT is omv-ha (Roundcube/dovecot). Mailcow on omv is retired —
# do not start it (it contributed to Pi 5 watchdog reboot storms).
if Path("/srv/mailcow/DISABLED.cloudless").is_file() or os.environ.get("SKIP_MAILCOW", "1") == "1":
    log("mailcow skipped (DISABLED.cloudless or SKIP_MAILCOW=1) — SoT is omv-ha")
    sys.exit(0)

if not Path(COMPOSE).is_file():
    log(f"no mailcow compose at {COMPOSE} — skip")
    sys.exit(0)

if not shutil.which("docker"):
    log("docker missing — skip")
    sys.exit(0)

log(f"stopping mailcow for {DELAY_SEC}s so k3s can settle")
subprocess.run(["docker", "compose", "-f", COMPOSE, "stop"],
               capture_output=True, check=False)

# Wait for load to drop or timeout
deadline = time.monotonic() + DELAY_SEC
elapsed = 0
while time.monotonic() < deadline:
    try:
        load1 = float(Path("/proc/loadavg").read_text().split()[0])
    except (OSError, ValueError, IndexError):
        load1 = 99.0
    if load1 < 8.0:
        log(f"load1={load1} < 8 — early resume ({elapsed}s elapsed)")
        break
    time.sleep(10)
    elapsed += 10

log("starting mailcow")
r = subprocess.run(["docker", "compose", "-f", COMPOSE, "up", "-d"],
                   capture_output=True, check=False)
if r.returncode != 0:
    log("WARN: mailcow up -d failed")
log("done")
