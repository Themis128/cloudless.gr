#!/usr/bin/env python3
"""install-safedeploy-watchdog.py — install (or refresh) the SafeDeploy
watchdog on omv. Run AS ROOT on omv itself, or via ssh:

  ssh tbaltzakis@omv "sudo python3 -" \
    < infrastructure/omv/install-safedeploy-watchdog.py

Port of install-safedeploy-watchdog.sh.

What it does (idempotent):
  1. Reads NTFY/SLACK/RESEND credentials from the cluster's cloudless-secrets
     Secret (namespace `cloudless`) via `k3s kubectl`. Nothing is echoed.
  2. Writes /etc/safedeploy-watchdog.env (mode 600, root:root).
  3. Copies the watchdog script + systemd unit + timer into place.
  4. Enables and starts the timer.
  5. Fires one immediate tick to prove the wiring, then prints last log lines.
"""

import base64
import os
import subprocess
import sys
import time
from pathlib import Path

if os.geteuid() != 0:
    print("must be root", file=sys.stderr)
    sys.exit(1)

REPO_DIR = Path(__file__).resolve().parent  # infrastructure/omv/
SCRIPT = REPO_DIR / "safedeploy-watchdog.py"
UNIT_SVC = REPO_DIR / "safedeploy-watchdog.service"
UNIT_TIMER = REPO_DIR / "safedeploy-watchdog.timer"

for f in (SCRIPT, UNIT_SVC, UNIT_TIMER):
    if not f.is_file():
        print(f"missing: {f}", file=sys.stderr)
        sys.exit(1)

print("[install] fetching alert credentials from k8s secret cloudless-secrets/cloudless…")


def b64(key: str) -> str:
    r = subprocess.run(
        [
            "k3s",
            "kubectl",
            "get",
            "secret",
            "cloudless-secrets",
            "-n",
            "cloudless",
            "-o",
            f"jsonpath={{.data.{key}}}",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        return base64.b64decode(r.stdout.strip()).decode()
    except Exception:
        return ""


NTFY_BASE_URL = b64("NTFY_BASE_URL")
# The cluster stores ntfy's IN-CLUSTER DNS (`http://ntfy.ntfy.svc.cluster.local`)
# — that only resolves inside a pod. This watchdog runs on the omv host, so
# rewrite in-cluster DNS to the LAN NodePort so notifications actually leave
# the box. Public URL (ntfy.cloudless.gr) would work too, but the LAN path
# is faster and works even if the Cloudflare tunnel is what's broken.
if ".svc.cluster.local" in NTFY_BASE_URL:
    NTFY_BASE_URL = "http://192.168.1.128:30080"
NTFY_TOPIC = b64("NTFY_TOPIC")
NTFY_TOKEN = b64("NTFY_TOKEN")
SLACK_BOT_TOKEN = b64("SLACK_BOT_TOKEN")
RESEND_API_KEY = b64("RESEND_API_KEY")
# Optional: Cloudflare analytics token powers the worker-error watcher.
# An analytics-read scoped token is enough (workersInvocationsAdaptive).
CF_API_TOKEN = b64("CLOUDFLARE_API_TOKEN")
CF_ACCOUNT_ID = b64("CLOUDFLARE_ACCOUNT_ID")
HEALTHCHECK_PING_URL = b64("HEALTHCHECK_PING_URL")


def present(name: str, val: str) -> None:
    print(f"  {'✓' if val else '✗'} {name}{f' (len {len(val)})' if val else ' MISSING'}")


present("NTFY_BASE_URL", NTFY_BASE_URL)
present("NTFY_TOPIC", NTFY_TOPIC)
present("NTFY_TOKEN", NTFY_TOKEN)
present("SLACK_BOT_TOKEN", SLACK_BOT_TOKEN)
present("RESEND_API_KEY", RESEND_API_KEY)
present("CF_API_TOKEN", CF_API_TOKEN)
present("CF_ACCOUNT_ID", CF_ACCOUNT_ID)

subprocess.run(
    ["install", "-d", "-m", "700", "-o", "root", "-g", "root", "/var/lib/safedeploy-watchdog"],
    check=True,
)
env_content = f"""\
# populated by install-safedeploy-watchdog.py — DO NOT edit by hand
NTFY_BASE_URL="{NTFY_BASE_URL}"
NTFY_TOPIC="{NTFY_TOPIC}"
NTFY_TOKEN="{NTFY_TOKEN}"
SLACK_BOT_TOKEN="{SLACK_BOT_TOKEN}"
SLACK_CHANNEL="#general"
RESEND_API_KEY="{RESEND_API_KEY}"
ALERT_EMAIL="tbaltzakis@cloudless.gr"
# Optional watchdog extensions (leave empty to disable):
#   CF_API_TOKEN/CF_ACCOUNT_ID → worker-error GraphQL watcher
#   HEALTHCHECK_PING_URL       → deadman ping (e.g. healthchecks.io)
CF_API_TOKEN="{CF_API_TOKEN}"
CF_ACCOUNT_ID="{CF_ACCOUNT_ID}"
HEALTHCHECK_PING_URL="{HEALTHCHECK_PING_URL}"
"""
env_path = Path("/etc/safedeploy-watchdog.env")
fd = os.open(env_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
os.write(fd, env_content.encode())
os.close(fd)
os.chown(env_path, 0, 0)
print("[install] wrote /etc/safedeploy-watchdog.env")


def install(src: Path, mode: int, dest: str) -> None:
    subprocess.run(
        ["install", "-m", str(mode), "-o", "root", "-g", "root", str(src), dest],
        check=True,
    )


install(SCRIPT, 755, "/usr/local/sbin/safedeploy-watchdog.py")
install(UNIT_SVC, 644, "/etc/systemd/system/safedeploy-watchdog.service")
install(UNIT_TIMER, 644, "/etc/systemd/system/safedeploy-watchdog.timer")
print("[install] installed script + units")

# Compat wrapper for callers that still invoke the .sh path
Path("/usr/local/sbin/safedeploy-watchdog.sh").write_text(
    '#!/bin/sh\nexec python3 /usr/local/sbin/safedeploy-watchdog.py "$@"\n'
)
os.chmod("/usr/local/sbin/safedeploy-watchdog.sh", 0o755)


def systemctl(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["systemctl", *args], capture_output=True, text=True, check=False)


systemctl("daemon-reload")
systemctl("enable", "--now", "safedeploy-watchdog.timer")
print("[install] timer enabled + started")

print("[install] firing one immediate tick to verify wiring…")
systemctl("start", "safedeploy-watchdog.service")
time.sleep(3)
print("[install] --- recent journal ---")
r = subprocess.run(
    ["journalctl", "-t", "safedeploy-watchdog", "-n", "8", "--no-pager"],
    capture_output=True,
    text=True,
    check=False,
)
print(
    r.stdout
    or subprocess.run(
        ["journalctl", "-u", "safedeploy-watchdog.service", "-n", "8", "--no-pager"],
        capture_output=True,
        text=True,
        check=False,
    ).stdout
)
print("[install] --- next scheduled run ---")
systemctl("list-timers", "safedeploy-watchdog.timer", "--no-pager")
print("[install] done.")
