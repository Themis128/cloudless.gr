#!/usr/bin/env python3
"""install-omv-main-monitor.py — install (or refresh) the disk monitor on omv.

Port of install-omv-main-monitor.sh.

Self-contained: all three scripts are embedded so this file
can be piped via stdin without needing the repo checked out on the Pi.

  ssh tbaltzakis@omv "sudo python3 -" \
    < infrastructure/omv/install-omv-main-monitor.py

What it does (idempotent):
  1. Writes cloudless-cleanup.py → /usr/local/sbin/cloudless-cleanup.py
     (plus a .sh compat wrapper for existing callers)
  2. Writes omv-main-alert.py → /usr/local/bin/omv-main-alert.py
  3. Writes omv-main-monitor.py → /usr/local/bin/omv-main-monitor.py
  4. Writes cron job → /etc/cron.d/omv-main-monitor (every 15 min)
  5. Fires one immediate check and prints the result.

Credentials: reuses /etc/safedeploy-watchdog.env — run
  install-safedeploy-watchdog.py first if that file doesn't exist.
"""

import os
import subprocess
import sys
from pathlib import Path

if os.geteuid() != 0:
    print("must be root", file=sys.stderr)
    sys.exit(1)

# The cleanup script is the repo's cloudless-cleanup.py — embedded so the
# installer stays self-contained when piped via ssh stdin.
REPO_DIR = Path(__file__).resolve().parent
EMBEDDED_CLEANUP = (
    (REPO_DIR / "cloudless-cleanup.py").read_text()
    if (REPO_DIR / "cloudless-cleanup.py").is_file()
    else ""
)

ALERT_SCRIPT = r'''#!/usr/bin/env python3
"""omv-main-alert — send a disk/system alert via ntfy + Slack + Resend email.

Usage: omv-main-alert <subject> [body] [severity]
  severity: warning | critical | ok   (default: warning)

Reads credentials from /etc/safedeploy-watchdog.env (shared with watchdog).
"""

import json
import os
import socket
import sys
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

ENV_FILE = Path("/etc/safedeploy-watchdog.env")
if ENV_FILE.is_file():
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

NTFY_BASE_URL = os.environ.get("NTFY_BASE_URL", "")
NTFY_TOPIC = os.environ.get("NTFY_TOPIC", "")
NTFY_TOKEN = os.environ.get("NTFY_TOKEN", "")
SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "")
SLACK_CHANNEL = os.environ.get("SLACK_CHANNEL", "#alerts")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
ALERT_EMAIL = os.environ.get("ALERT_EMAIL", "tbaltzakis@cloudless.gr")

SUBJECT = sys.argv[1] if len(sys.argv) > 1 else "OMV Alert"
BODY = sys.argv[2] if len(sys.argv) > 2 else "No details"
SEVERITY = sys.argv[3] if len(sys.argv) > 3 else "warning"

if SEVERITY in ("ok", "success"):
    NTFY_PRIO, ICON = "low", "✅"
elif SEVERITY in ("critical", "error", "urgent"):
    NTFY_PRIO, ICON = "urgent", "🚨"
else:
    NTFY_PRIO, ICON = "high", "⚠️"

FULL_TITLE = f"[OMV] {SUBJECT}"
FULL_BODY = f"{BODY}\nHost: {socket.gethostname()} | {datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%SZ')}"


def post(url: str, headers: dict, body: bytes) -> bool:
    try:
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        urllib.request.urlopen(req, timeout=10)
        return True
    except Exception:
        return False


if NTFY_BASE_URL and NTFY_TOPIC:
    headers = {"Title": FULL_TITLE, "Priority": NTFY_PRIO, "Tags": "warning,floppy_disk"}
    if NTFY_TOKEN:
        headers["Authorization"] = f"Bearer {NTFY_TOKEN}"
    ok = post(f"{NTFY_BASE_URL.rstrip('/')}/{NTFY_TOPIC}", headers, FULL_BODY.encode())
    print(f"[alert] ntfy {'sent' if ok else 'failed (non-fatal)'}")

if SLACK_BOT_TOKEN:
    payload = json.dumps({"channel": SLACK_CHANNEL, "text": f"{ICON} {FULL_TITLE}\n{FULL_BODY}"}).encode()
    ok = post("https://slack.com/api/chat.postMessage",
              {"Authorization": f"Bearer {SLACK_BOT_TOKEN}",
               "Content-Type": "application/json; charset=utf-8"}, payload)
    print(f"[alert] Slack {'sent' if ok else 'failed (non-fatal)'}")

if RESEND_API_KEY:
    payload = json.dumps({
        "from": "alerts@cloudless.gr",
        "to": ALERT_EMAIL,
        "subject": FULL_TITLE,
        "text": FULL_BODY,
    }).encode()
    ok = post("https://api.resend.com/emails",
              {"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"}, payload)
    print(f"[alert] email {'sent via Resend' if ok else 'failed (non-fatal)'}")

print(f"[alert] {SEVERITY} — {SUBJECT}")
'''

MONITOR_SCRIPT = r'''#!/usr/bin/env python3
"""omv-main-monitor — disk health cron for omv control-plane (Pi 5).

Cron (every 15 min, written by install-omv-main-monitor.py):
  */15 * * * * root /usr/local/bin/omv-main-monitor.py >> /var/log/omv-main-monitor.log 2>&1

Thresholds:
  root ≥ 50%  → proactive cleanup (max once per 3h)
  root ≥ 85%  → warning alert (max once per 1h)
  root ≥ 90%  → critical alert
  sda1 ≥ 80%  → warning; ≥ 90% → critical
  sdb1 ≥ 80%  → warning; ≥ 92% → critical
"""

import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path

ALERT_SCRIPT = "/usr/local/bin/omv-main-alert.py"
CLEANUP_SCRIPT = "/usr/local/sbin/cloudless-cleanup.py"
STAMP_DIR = Path("/run/omv-monitor")
COOLDOWN_ALERT = 3600     # 1h between repeated alerts per device
COOLDOWN_CLEANUP = 10800  # 3h between auto-triggered cleanups

SDB1_MOUNT = "/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7"

STAMP_DIR.mkdir(parents=True, exist_ok=True)


def _pct(mount: str) -> int:
    r = subprocess.run(["df", mount, "--output=pcent"], capture_output=True, text=True, check=False)
    lines = (r.stdout or "").splitlines()
    return int("".join(c for c in lines[-1] if c.isdigit()) or 0) if len(lines) > 1 else 0


def _stamp_age(key: str) -> int:
    f = STAMP_DIR / key
    if not f.is_file():
        return 9999999
    try:
        return int(time.time()) - int(f.read_text().strip())
    except (ValueError, OSError):
        return 9999999


def _stamp_set(key: str) -> None:
    (STAMP_DIR / key).write_text(f"{int(time.time())}\n")


def log(msg: str) -> None:
    print(f"[{datetime.now(UTC).strftime('%H:%M:%S')}] {msg}")


def _maybe_alert(key: str, pct: int, label: str, sev: str) -> None:
    if _stamp_age(f"alert-{key}") >= COOLDOWN_ALERT:
        _stamp_set(f"alert-{key}")
        subprocess.run(
            ["python3", ALERT_SCRIPT,
             f"{sev.upper()}: Disk {pct}%: {label} is {pct}% full.", "", sev],
            check=False,
        )
        log(f"ALERT {sev} — {label} {pct}%")
    else:
        log(f"SUPPRESSED {sev} — {label} {pct}% (cooldown active)")


def check_disk(mount: str, warn: int, crit: int, label: str, key: str) -> None:
    if not Path(mount).is_dir():
        log(f"SKIP {label} — mount not found")
        return
    pct = _pct(mount)
    if pct >= crit:
        _maybe_alert(key, pct, label, "critical")
    elif pct >= warn:
        _maybe_alert(key, pct, label, "warning")
    else:
        (STAMP_DIR / f"alert-{key}").unlink(missing_ok=True)


# ── Root: edge-triggered cleanup at 50%, alert at 85%/90% ───────────────────
ROOT_PCT = _pct("/")
PREV_PCT_FILE = STAMP_DIR / "root-pct-prev"
try:
    PREV_PCT = int(PREV_PCT_FILE.read_text().strip())
except (ValueError, OSError):
    PREV_PCT = 0
PREV_PCT_FILE.write_text(f"{ROOT_PCT}\n")

# Cleanup fires immediately when root crosses the 50% threshold going up.
# If cleanup didn't drop below 50%, the 3h cooldown allows a retry.
run_cleanup = False
if ROOT_PCT >= 50:
    if PREV_PCT < 50:
        log(f"Root crossed 50% ({PREV_PCT}% → {ROOT_PCT}%) — immediate cleanup")
        run_cleanup = True
    elif _stamp_age("cleanup-root") >= COOLDOWN_CLEANUP:
        log(f"Root {ROOT_PCT}% ≥ 50% — periodic cleanup (cooldown elapsed)")
        run_cleanup = True

if run_cleanup:
    _stamp_set("cleanup-root")
    with open("/var/log/cloudless-cleanup.log", "a") as lf:
        subprocess.run(["python3", CLEANUP_SCRIPT], stdout=lf, stderr=subprocess.STDOUT, check=False)
    ROOT_PCT = _pct("/")
    log(f"Root after cleanup: {ROOT_PCT}%")

check_disk("/", 85, 90, "Root (SD card 58GB)", "root")
check_disk("/var/lib/rancher/k3s", 80, 90, "k3s SSD (sda1 119GB)", "k3s")
check_disk(SDB1_MOUNT, 80, 92, "UserData (sdb1 916GB)", "sdb1")
'''

CRON_FILE = """\
# omv-main-monitor — disk health check every 15 minutes
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/15 * * * * root /usr/local/bin/omv-main-monitor.py >> /var/log/omv-main-monitor.log 2>&1
"""

SH_WRAPPER = '#!/bin/sh\nexec python3 {target} "$@"\n'


def write_exec(path: str, content: str) -> None:
    Path(path).write_text(content)
    os.chmod(path, 0o755)


def compat(sh_path: str, py_path: str) -> None:
    write_exec(sh_path, SH_WRAPPER.format(target=py_path))


# ── 1. cloudless-cleanup.py ──────────────────────────────────────────────────
print("[install] writing /usr/local/sbin/cloudless-cleanup.py")
if EMBEDDED_CLEANUP:
    write_exec("/usr/local/sbin/cloudless-cleanup.py", EMBEDDED_CLEANUP)
    compat("/usr/local/sbin/cloudless-cleanup.sh", "/usr/local/sbin/cloudless-cleanup.py")
else:
    print("  (embedded cleanup source missing — run from repo checkout)", file=sys.stderr)

# ── 2. omv-main-alert.py ─────────────────────────────────────────────────────
print("[install] writing /usr/local/bin/omv-main-alert.py")
write_exec("/usr/local/bin/omv-main-alert.py", ALERT_SCRIPT)
compat("/usr/local/bin/omv-main-alert", "/usr/local/bin/omv-main-alert.py")

# ── 3. omv-main-monitor.py ───────────────────────────────────────────────────
print("[install] writing /usr/local/bin/omv-main-monitor.py")
write_exec("/usr/local/bin/omv-main-monitor.py", MONITOR_SCRIPT)
compat("/usr/local/bin/omv-main-monitor", "/usr/local/bin/omv-main-monitor.py")

# ── 4. Cron job ──────────────────────────────────────────────────────────────
print("[install] writing /etc/cron.d/omv-main-monitor")
Path("/etc/cron.d/omv-main-monitor").write_text(CRON_FILE)
os.chmod("/etc/cron.d/omv-main-monitor", 0o644)

# ── 5. Verify credentials ────────────────────────────────────────────────────
print("\n[install] checking /etc/safedeploy-watchdog.env...")
env_path = Path("/etc/safedeploy-watchdog.env")
if env_path.is_file():
    if "RESEND_API_KEY" in env_path.read_text():
        print("  ✓ credentials present")
    else:
        print("  ⚠ RESEND_API_KEY missing — run install-safedeploy-watchdog.py first")
else:
    print("  ✗ /etc/safedeploy-watchdog.env MISSING — alerts will be silent")
    print(
        "    Run: ssh tbaltzakis@omv 'sudo python3 -' < infrastructure/omv/install-safedeploy-watchdog.py"
    )

# ── 6. Immediate check ───────────────────────────────────────────────────────
print("\n[install] firing immediate disk check...")
Path("/run/omv-monitor").mkdir(parents=True, exist_ok=True)
subprocess.run(["python3", "/usr/local/bin/omv-main-monitor.py"], check=False)

print("\n[install] disk usage summary:")
subprocess.run(
    [
        "df",
        "-h",
        "/",
        "/var/lib/rancher/k3s",
        "/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7",
    ],
    check=False,
)

print("\n[install] done.")
print("  Cleanup log: tail -f /var/log/cloudless-cleanup.log")
print("  Monitor log: tail -f /var/log/omv-main-monitor.log")
print("  Run cleanup now: sudo python3 /usr/local/sbin/cloudless-cleanup.py")
