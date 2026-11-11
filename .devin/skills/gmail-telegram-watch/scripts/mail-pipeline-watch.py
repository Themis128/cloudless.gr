"""Inbound mail pipeline probe (one-shot, run via schtasks).

Sends a unique-tagged test mail through the mail-outbound worker
(Cloudflare Email Sending -> Email Routing -> mail-ingest worker ->
webmail.cloudless.gr/ingest -> dovecot Maildir on omv-ha), then polls
the Maildir over SSH until the message lands or the deadline hits.

Telegram alert on failure only (throttled to once per 4h).
Success is logged silently.

usage: python mail-pipeline-watch.py [--tg-test]
"""

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

KEYS = "C:/Users/tbaltzakis/AppData/Roaming/devin/secrets"
DIR = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(DIR, "mail-pipeline-state.json")
BOT = open(KEYS + "/tg-bot-token").read().strip()
OUT = json.load(open(KEYS + "/mail-outbound.json"))
SSH = [
    "ssh",
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=10",
    "-i",
    os.path.expanduser("~/.ssh/id_rsa"),
    "tbaltzakis@100.95.117.84",
]
TO = "tbaltzakis@cloudless.gr"
POLL_SECS = 15
DEADLINE_SECS = 360
FAIL_ALERT_EVERY = 4 * 3600


def tg(text, chat_id="7017840434"):
    data = urllib.parse.urlencode({"chat_id": chat_id, "text": text}).encode()
    urllib.request.urlopen(f"https://api.telegram.org/bot{BOT}/sendMessage", data=data, timeout=15)


def send_probe(subject):
    body = json.dumps(
        {
            "to": TO,
            "subject": subject,
            "text": "Automated inbound pipeline probe.",
            "category": "ops-alert",
        }
    ).encode()
    req = urllib.request.Request(
        OUT["url"],
        data=body,
        method="POST",
        headers={
            "Authorization": "Bearer " + OUT["token"],
            "Content-Type": "application/json",
            "User-Agent": "mail-pipeline-watch/1.0",
        },
    )
    return json.loads(urllib.request.urlopen(req, timeout=30).read())


HEAL = (
    "C:/Users/tbaltzakis/AppData/Roaming/devin/skills/"
    "cloudless-mail-ops/scripts/mail-outbound-heal.py"
)


def send_probe_healed(subject):
    """send_probe + auto-repair on 401 (MAIL_OUTBOUND_TOKEN drift)."""
    try:
        return send_probe(subject)
    except urllib.error.HTTPError as e:
        if e.code != 401:
            raise
        print("send_probe 401 — running mail-outbound-heal")
        r = subprocess.run([sys.executable, HEAL], capture_output=True, text=True, timeout=120)
        print("heal:", (r.stdout or r.stderr).strip()[:300])
        time.sleep(5)
        return send_probe(subject)


def delivered(tag):
    # mail-outbound stores the subject as an =?utf-8?B?...?= encoded word,
    # so grep for the raw tag AND a prefix of its base64 form. Only whole
    # 3-byte groups are safe: 52 chars = 39 tag bytes, covering the
    # timestamp to the second plus 4 hex chars of the uuid suffix —
    # unique per probe (40 chars stopped at the hour and false-matched
    # earlier same-hour probes).
    import base64

    pats = [tag, base64.b64encode(tag.encode()).decode()[:52]]
    for pat in pats:
        cmd = (
            "sudo -n grep -rls "
            + repr(pat)
            + " /var/mail/vhosts/cloudless.gr/ 2>/dev/null | head -1"
        )
        r = subprocess.run(SSH + [cmd], capture_output=True, text=True, timeout=60)
        if r.stdout.strip():
            return True
    return False


def save(st):
    json.dump(st, open(STATE, "w", encoding="utf-8"))


def fail(msg):
    st = json.load(open(STATE)) if os.path.exists(STATE) else {}
    if time.time() - st.get("fail_alert", 0) > FAIL_ALERT_EVERY:
        try:
            tg(
                "MAIL PIPELINE FAIL\n\n"
                + msg
                + "\n\nProbe: mail-outbound -> CF Email Sending -> Email Routing "
                "-> mail-ingest -> webmail.cloudless.gr/ingest -> dovecot."
            )
        except Exception as e:
            print("tg err", e)
        st["fail_alert"] = time.time()
        save(st)
    print("FAIL:", msg)


def main():
    tag = "PIPELINE-TEST-AUTO-" + time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
    try:
        res = send_probe_healed(tag)
        print("sent:", res)
        if not res.get("ok"):
            fail("mail-outbound /send rejected: " + json.dumps(res)[:300])
            return
    except Exception as e:
        fail("mail-outbound /send threw: " + str(e)[:300])
        return

    deadline = time.time() + DEADLINE_SECS
    while time.time() < deadline:
        time.sleep(POLL_SECS)
        try:
            if delivered(tag):
                st = json.load(open(STATE)) if os.path.exists(STATE) else {}
                st["last_ok"] = time.time()
                save(st)
                print("OK delivered:", tag)
                return
        except Exception as e:
            print("poll err", e)
    fail(f"probe not delivered within {DEADLINE_SECS}s: {tag}")


if __name__ == "__main__":
    if "--tg-test" in sys.argv:
        tg("mail-pipeline-watch self-test OK")
        sys.exit(0)
    try:
        main()
    except Exception as e:
        print("err", e)
        fail("watcher crashed: " + str(e)[:300])
