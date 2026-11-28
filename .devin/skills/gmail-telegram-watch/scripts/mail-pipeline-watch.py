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
MAILBOX_DIR = "/var/mail/vhosts/cloudless.gr/tbaltzakis"
POLL_SECS = 15
DEADLINE_SECS = 360
RETRY_DEADLINE_SECS = 240
FRESH_MINS = 20
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
        # Scope to the probe's own mailbox and only files touched in the
        # last FRESH_MINS — a recursive grep over the whole vhosts tree
        # (3k+ INBOX messages) repeatedly blew the 60s subprocess timeout
        # and produced false FAILs when every poll errored.
        cmd = "sudo -n sh -c " + repr(
            "find "
            + MAILBOX_DIR
            + " -type f -mmin -"
            + str(FRESH_MINS)
            + " -print0 2>/dev/null | xargs -0 -r grep -ls "
            + repr(pat)
            + " 2>/dev/null | head -1"
        )
        r = subprocess.run(SSH + [cmd], capture_output=True, text=True, timeout=60)
        if r.returncode != 0:
            raise RuntimeError(f"ssh poll rc={r.returncode}: {(r.stderr or '')[:200]}")
        if r.stdout.strip():
            return True
    return False


def load():
    try:
        return json.load(open(STATE, encoding="utf-8"))
    except Exception:
        return {}


def save(st):
    tmp = STATE + ".tmp"
    json.dump(st, open(tmp, "w", encoding="utf-8"))
    os.replace(tmp, STATE)


def fail(msg):
    st = load()
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


def poll_until(tag, deadline_secs):
    """Poll for delivery; returns (found, poll_errors)."""
    deadline = time.time() + deadline_secs
    errors = 0
    while time.time() < deadline:
        time.sleep(POLL_SECS)
        try:
            if delivered(tag):
                return True, errors
        except Exception as e:
            errors += 1
            print("poll err", e)
    return False, errors


def mark_ok():
    st = load()
    st["last_ok"] = time.time()
    save(st)


def new_tag():
    return "PIPELINE-TEST-AUTO-" + time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]


def send_or_fail(tag):
    try:
        res = send_probe_healed(tag)
        print("sent:", res)
        if not res.get("ok"):
            fail("mail-outbound /send rejected: " + json.dumps(res)[:300])
            return False
        return True
    except Exception as e:
        fail("mail-outbound /send threw: " + str(e)[:300])
        return False


def main():
    tag = new_tag()
    if not send_or_fail(tag):
        return

    found, errors = poll_until(tag, DEADLINE_SECS)
    if found:
        mark_ok()
        print("OK delivered:", tag)
        return

    # One automatic retry: CF Email Sending -> Email Routing occasionally
    # drops a single message between send_email accept and worker
    # invocation (observed 2026-11-17 ~06:30-07:10 EET — no worker hit, no
    # ingest POST, no Gmail fallback, no bounce). A second probe
    # distinguishes a transient drop from a real outage.
    tag2 = new_tag()
    print("first probe lost; retrying once as", tag2)
    if not send_or_fail(tag2):
        return
    found2, errors2 = poll_until(tag2, RETRY_DEADLINE_SECS)
    if found2:
        mark_ok()
        print("OK delivered on retry (transient drop):", tag2)
        return

    if errors + errors2 == 0:
        fail(
            f"probe not delivered within {DEADLINE_SECS}s "
            f"(+{RETRY_DEADLINE_SECS}s retry): {tag} / {tag2}"
        )
    else:
        fail(
            f"probe not delivered; {errors + errors2}/"
            f"{2 * (DEADLINE_SECS // POLL_SECS)} polls failed "
            f"(SSH/Tailscale?): {tag} / {tag2}"
        )


if __name__ == "__main__":
    if "--tg-test" in sys.argv:
        tg("mail-pipeline-watch self-test OK")
        sys.exit(0)
    try:
        main()
    except Exception as e:
        print("err", e)
        fail("watcher crashed: " + str(e)[:300])
