"""End-to-end self-test + self-heal for the gmail-telegram-watch skill.

Checks Gmail auth, every watch config (thread fetch + state), Telegram
delivery, and the DevinGmailWatch scheduled task.

usage:
  python self-test.py            # report only, exit 1 on any failure
  python self-test.py --tg       # also send a live test message
  python self-test.py --fix      # recreate DevinGmailWatch if missing/broken
  python self-test.py --tg-alert # Telegram ONLY on failure (for schtasks)

Scheduled as GmailWatchSelfTest every 6h: --fix --tg-alert
"""

import glob
import importlib.util
import io
import json
import os
import subprocess
import sys
import time
import urllib.parse
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
DIR = os.path.dirname(os.path.abspath(__file__))
KEYS = "C:/Users/tbaltzakis/AppData/Roaming/devin/secrets"
BAT = os.path.join(DIR, "run-all-watches.vbs")
SEND_TG = "--tg" in sys.argv
FIX = "--fix" in sys.argv
TG_ALERT = "--tg-alert" in sys.argv
results = []


def check(name, fn):
    try:
        results.append((name, fn()))
    except Exception as e:
        results.append((name, "FAIL: " + str(e)))


def load_watcher(cfg_path):
    spec = importlib.util.spec_from_file_location("w", os.path.join(DIR, "gmail-thread-watch.py"))
    sys.argv = ["x", cfg_path]
    w = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(w)
    return w


def t_auth():
    w = load_watcher(glob.glob(os.path.join(DIR, "watches", "*.json"))[0])
    return "authed " + w.api("profile")["emailAddress"]


def make_thread_check(cfg_path):
    def t():
        w = load_watcher(cfg_path)
        st = json.load(open(w.STATE, encoding="utf-8")) if os.path.exists(w.STATE) else {}
        if "thread_id" not in st:
            return "dormant (no thread match yet)"
        n = len(w.api("threads/" + st["thread_id"])["messages"])
        return f"{st['thread_id']} / {n} msgs / {len(st.get('seen', []))} seen"

    return t


def t_task():
    out = subprocess.run(
        ["schtasks", "/query", "/tn", "DevinGmailWatch", "/fo", "csv"],
        capture_output=True,
        text=True,
    )
    if out.returncode or "DevinGmailWatch" not in out.stdout:
        if not FIX:
            raise RuntimeError("task missing (run with --fix to recreate)")
        r = subprocess.run(
            [
                "schtasks",
                "/create",
                "/tn",
                "DevinGmailWatch",
                "/tr",
                f'wscript.exe "{BAT}"',
                "/sc",
                "minute",
                "/mo",
                "10",
                "/f",
            ],
            capture_output=True,
            text=True,
        )
        if r.returncode:
            raise RuntimeError("recreate failed: " + r.stderr.strip())
        return "recreated, Ready"
    return out.stdout.splitlines()[1].split(",")[-1].strip('"')


def tg(text):
    bot = open(KEYS + "/tg-bot-token").read().strip()
    data = urllib.parse.urlencode({"chat_id": "7017840434", "text": text}).encode()
    urllib.request.urlopen(f"https://api.telegram.org/bot{bot}/sendMessage", data=data, timeout=15)


check("Gmail API auth", t_auth)
for cfg in sorted(glob.glob(os.path.join(DIR, "watches", "*.json"))):
    check("watch:" + json.load(open(cfg, encoding="utf-8"))["name"], make_thread_check(cfg))
check("DevinGmailWatch task", t_task)

if SEND_TG:

    def t_tg():
        w = load_watcher(glob.glob(os.path.join(DIR, "watches", "*.json"))[0])
        w.tg("gmail-telegram-watch self-test OK " + time.strftime("%H:%M:%S"))
        return "delivered"

    check("Telegram send", t_tg)

fails = [r for r in results if "FAIL" in r[1]]
for name, res in results:
    print(f"{'FAIL' if 'FAIL' in res else 'PASS'}  {name}: {res}")

if fails and TG_ALERT:
    try:
        tg(
            "gmail-telegram-watch SELF-TEST FAILED:\n\n"
            + "\n".join(f"• {n}: {r}" for n, r in fails)
            + "\n\n(python self-test.py for full report)"
        )
    except Exception as e:
        print("tg alert err", e)

sys.exit(1 if fails else 0)
