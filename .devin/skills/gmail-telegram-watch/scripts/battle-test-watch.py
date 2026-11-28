"""Battle-test a gmail-thread-watch config end-to-end.

Injects a fake INBOUND message (via users.messages.insert, gmail.modify
token), temporarily repoints the watch's state at the test thread, runs
gmail-thread-watch.py, verifies the Telegram alert fires, then restores
the real state and trashes the test message.

NOTE: messages.insert does NOT thread into existing threads (Gmail API
limitation) — that is why the state repoint is needed. The query->thread
resolution and real-SMTP threading are NOT exercised; everything else
(thread fetch, inbound filter, OTP skip, Telegram send, state save) is.

usage: python battle-test-watch.py <watch-name> [--keep-test]
  e.g. python battle-test-watch.py koropi-police
"""

import base64
import io
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

KEYS = os.path.join(os.environ["APPDATA"], "devin", "secrets")
DIR = os.path.dirname(os.path.abspath(__file__))
TOKEN_FILE = KEYS + "/gmail-send-token.json"
GKEYS = r"C:\Users\tbaltzakis\.config\google-calendar-mcp\gcp-oauth.keys.json"
WATCH_PY = os.path.join(DIR, "gmail-thread-watch.py")

if len(sys.argv) < 2:
    raise SystemExit(__doc__)
NAME = sys.argv[1]
KEEP = "--keep-test" in sys.argv
CFG_PATH = os.path.join(DIR, "watches", NAME + ".json")
STATE_PATH = os.path.join(DIR, NAME + "-state.json")

cfg = json.load(open(CFG_PATH, encoding="utf-8"))


def access_token():
    t = json.load(open(TOKEN_FILE))
    if t.get("expires_at", 0) < time.time():
        k = json.load(open(GKEYS))
        ci = k.get("installed") or k.get("web")
        data = urllib.parse.urlencode(
            {
                "client_id": ci["client_id"],
                "client_secret": ci["client_secret"],
                "refresh_token": t["refresh_token"],
                "grant_type": "refresh_token",
            }
        ).encode()
        n = json.loads(urllib.request.urlopen(ci["token_uri"], data=data, timeout=30).read())
        t.update(n)
        t["expires_at"] = time.time() + n["expires_in"] - 60
        json.dump(t, open(TOKEN_FILE, "w"))
    return t["access_token"]


def api(method, path, payload=None):
    req = urllib.request.Request(
        "https://gmail.googleapis.com/gmail/v1/users/me/" + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        method=method,
        headers={"Authorization": "Bearer " + access_token(), "Content-Type": "application/json"},
    )
    return json.loads(urllib.request.urlopen(req, timeout=30).read())


def enc(s):
    return "=?utf-8?b?" + base64.b64encode(s.encode()).decode() + "?="


# 1. inject fake inbound reply-looking message
tag = "BT-" + NAME + "-" + str(int(time.time()))
frm = cfg.get("test_from", "watch-test <noreply@example.com>")
subj = cfg.get("test_subject", "Re: " + cfg.get("alert_prefix", NAME))
local, addr = frm.split("<", 1) if "<" in frm else (frm, frm)
addr = addr.rstrip(">").strip()
raw = (
    "From: " + enc(local.strip()) + " <" + addr + ">\r\n"
    "To: baltzakis.themis@gmail.com\r\n"
    "Subject: " + enc(subj + " [" + tag + "]") + "\r\n"
    "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n"
    "Automated watch battle-test " + tag + " (" + NAME + "). Ignore.\r\n"
).encode("utf-8")
res = api(
    "POST", "messages", {"raw": base64.urlsafe_b64encode(raw).decode(), "labelIds": ["INBOX"]}
)
test_id, test_thread = res["id"], res["threadId"]
print("injected:", test_id, "thread:", test_thread)

# 2. backup + repoint state
backup = STATE_PATH + ".bt-bak"
shutil.copy2(STATE_PATH, backup)
json.dump({"thread_id": test_thread, "seen": []}, open(STATE_PATH, "w", encoding="utf-8"))

ok = False
try:
    # 3. run the real watcher
    p = subprocess.run(
        [sys.executable, WATCH_PY, CFG_PATH], capture_output=True, text=True, timeout=120
    )
    print(p.stdout.strip() or p.stderr.strip())
    ok = "alerted" in (p.stdout + p.stderr)
finally:
    # 4. restore state, trash test message
    shutil.copy2(backup, STATE_PATH)
    os.remove(backup)
    if not KEEP:
        try:
            api("POST", "messages/" + test_id + "/trash")
            print("test message trashed")
        except Exception as e:
            print("trash failed:", e)

print("RESULT:", "PASS" if ok else "FAIL", "- check Telegram for [" + NAME + "] alert")
sys.exit(0 if ok else 1)
