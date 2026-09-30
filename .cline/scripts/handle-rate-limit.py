#!/usr/bin/env python3
"""Rate limit handling script for Cline agent.

Port of handle-rate-limit.sh. Handles 429 Too Many Requests errors
with exponential backoff.

Usage: python3 handle-rate-limit.py execute <command>
"""

import random
import shlex
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

MAX_RETRIES = 5
BASE_DELAY = 1  # seconds
LOG_FILE = Path("/tmp/.cline-rate-limit.log")


def log(msg: str) -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with LOG_FILE.open("a") as fh:
        fh.write(f"[{ts}] {msg}\n")


def handle_429(attempt: int) -> bool:
    delay = BASE_DELAY * (2 ** (attempt - 1))  # Exponential backoff
    jitter = random.randint(0, 999) / 1000  # Prevent thundering herd
    total_delay = delay + jitter
    log(
        f"Rate limit hit (429). Attempt {attempt}/{MAX_RETRIES}. Waiting {total_delay:.3f} seconds..."
    )
    time.sleep(total_delay)
    if attempt < MAX_RETRIES:
        return True
    log(f"Max retries ({MAX_RETRIES}) exceeded for rate limit handling")
    return False


if len(sys.argv) < 3 or sys.argv[1] != "execute":
    print(f"Usage: {sys.argv[0]} execute <command>")
    sys.exit(1)

cmd = shlex.join(sys.argv[2:])
output = ""
exit_code = 0

for attempt in range(1, MAX_RETRIES + 1):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=False)
    output = r.stdout + r.stderr
    exit_code = r.returncode

    if '"status":429' in output or "429 status code" in output:
        if handle_429(attempt):
            continue
    print(output, end="")
    sys.exit(exit_code)

print(output, end="")
sys.exit(exit_code)
