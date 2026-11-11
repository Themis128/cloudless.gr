"""Generic Gmail-thread reply watcher (one-shot, run via schtasks).

usage: python gmail-thread-watch.py <config.json>

config.json fields:
  name         - used for state file <name>-state.json and alert prefix
  query        - Gmail search to locate the thread to watch
  chat_id      - (optional) Telegram chat, default 7017840434
  alert_prefix - (optional) text before alert, default "<name> replied!"

Finds the thread matching `query` once, then alerts on Telegram whenever a
new INBOUND message lands in it. State: <name>-state.json next to this file.
"""

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from email.header import decode_header, make_header

KEYS = "C:/Users/tbaltzakis/AppData/Roaming/devin/secrets"
GKEYS = r"C:\Users\tbaltzakis\.config\google-calendar-mcp\gcp-oauth.keys.json"
DIR = os.path.dirname(os.path.abspath(__file__))

if len(sys.argv) < 2:
    raise SystemExit(__doc__)
cfg = json.load(open(sys.argv[1], encoding="utf-8"))
NAME = cfg["name"]
QUERY = cfg["query"]
CHAT_ID = str(cfg.get("chat_id", "7017840434"))
PREFIX = cfg.get("alert_prefix", NAME + " replied!")
STATE = os.path.join(DIR, NAME + "-state.json")
BOT = open(KEYS + "/tg-bot-token").read().strip()


def gmail_token():
    t = json.load(open(KEYS + "/gmail-token.json"))
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
        n = json.loads(urllib.request.urlopen(ci["token_uri"], data=data).read())
        t.update(n)
        t["expires_at"] = time.time() + n["expires_in"] - 60
        if "refresh_token_expires_in" in n:
            t["refresh_expires_at"] = time.time() + n["refresh_token_expires_in"] - 3600
        json.dump(t, open(KEYS + "/gmail-token.json", "w"))
    return t["access_token"]


def api(path):
    r = urllib.request.Request(
        "https://gmail.googleapis.com/gmail/v1/users/me/" + path,
        headers={"Authorization": "Bearer " + gmail_token()},
    )
    return json.loads(urllib.request.urlopen(r, timeout=30).read())


def tg(text):
    data = urllib.parse.urlencode({"chat_id": CHAT_ID, "text": text}).encode()
    urllib.request.urlopen(f"https://api.telegram.org/bot{BOT}/sendMessage", data=data, timeout=15)


def header(m, name):
    return next(
        (h["value"] for h in m["payload"]["headers"] if h["name"].lower() == name.lower()), ""
    )


OTP_SUBJ = re.compile(
    r"κωδικ|κωδικό|επιβεβαίωσ|one[- ]?time|verification code|"
    r"\botp\b|passcode|security code|2fa|two[- ]factor|sign[- ]?in code",
    re.IGNORECASE,
)


def dec(raw):
    try:
        return str(make_header(decode_header(raw or "")))
    except Exception:
        return raw or ""


def is_otp(subject):
    return bool(OTP_SUBJ.search(dec(subject)))


def save(st):
    json.dump(st, open(STATE, "w", encoding="utf-8"))


def main():
    st = json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {}

    if "thread_id" not in st:
        q = urllib.parse.quote(QUERY)
        msgs = api(f"messages?q={q}&maxResults=5").get("messages", [])
        if not msgs:
            print(f"[{NAME}] thread not found yet")
            return
        st["thread_id"] = msgs[0]["threadId"]
        st["seen"] = [m["id"] for m in api("threads/" + st["thread_id"])["messages"]]
        save(st)
        print(f"[{NAME}] baseline thread {st['thread_id']}, {len(st['seen'])} msgs")
        return

    th = api("threads/" + st["thread_id"])
    inbound = [
        m
        for m in th["messages"]
        if m["id"] not in st["seen"] and "SENT" not in m.get("labelIds", [])
    ]
    if inbound:
        for m in inbound:
            sub = dec(header(m, "Subject"))
            if is_otp(sub):
                # Codes are machine-consumed / expire in minutes — never
                # broadcast the snippet (it contains the live code).
                print(f"[{NAME}] skipped OTP mail:", header(m, "From"), "|", sub)
                continue
            tg(
                f"{PREFIX}\n\nFrom: {header(m, 'From')}\nSubject: {sub}\n\n{m.get('snippet', '')[:300]}"
            )
        st["seen"] = [m["id"] for m in th["messages"]]
        save(st)
        print(f"[{NAME}] alerted {len(inbound)}")
    else:
        print(f"[{NAME}] no new inbound", time.strftime("%H:%M"))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("err", e)
        st = json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {}
        if time.time() - st.get("err_alert", 0) > 86400:
            try:
                tg(f"{NAME} watch error: {e}")
                st["err_alert"] = time.time()
                save(st)
            except Exception:
                pass
