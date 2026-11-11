"""Case-mail watcher: polls Gmail for replies from the authorities handling
the unemployment-benefit case (Synigoros / DYPA / SEPE-YEKA) and posts them
to Telegram. One-shot per run — meant for a scheduled task every ~5 min.
State (seen message ids) kept in case-watch-state.json next to this file."""

import json
import os
import re
import time
import urllib.parse
import urllib.request
from email.header import decode_header, make_header

KEYS = "C:/Users/tbaltzakis/AppData/Roaming/devin/secrets"
DIR = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(DIR, "case-watch-state.json")
CHAT_ID = "7017840434"
BOT = open(KEYS + "/tg-bot-token").read().strip()
QUERY = (
    "in:anywhere -in:trash newer_than:2d "
    "(from:synigoros.gr OR from:dypa.gov.gr OR from:gov.gr OR "
    "from:hli.gov.gr OR from:yeka.gr OR from:efka.gov.gr)"
)


def gmail_token():
    t = json.load(open(KEYS + "/gmail-token.json"))
    if t.get("expires_at", 0) < time.time():
        k = json.load(open(r"C:\Users\tbaltzakis\.config\google-calendar-mcp\gcp-oauth.keys.json"))
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


def main():
    st = json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {"seen": []}
    seen = set(st.get("seen", []))
    res = api("messages?q=" + urllib.parse.quote(QUERY) + "&maxResults=20")
    fresh = []
    for m in res.get("messages", []):
        if m["id"] in seen:
            continue
        full = api(
            "messages/"
            + m["id"]
            + "?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date"
        )
        seen.add(m["id"])
        fresh.append(full)
    # keep state bounded
    st["seen"] = list(seen)[-500:]
    json.dump(st, open(STATE, "w", encoding="utf-8"))
    for m in fresh:
        frm = header(m, "From")
        sub = dec(header(m, "Subject"))
        dt = header(m, "Date")
        if is_otp(sub):
            # OTP codes are control-plane input for scripts/synigoros-monitor
            # (monitor.js fetches them from Gmail itself). Broadcasting them
            # here is pure noise + leaks a live credential — mark seen, skip.
            print("skipped OTP mail:", frm, "|", sub)
            continue
        snip = (m.get("snippet") or "")[:300]
        tg(
            f"📨 Νέο mail από αρχή (υπόθεση επιδόματος):\n\nFrom: {frm}\nDate: {dt}\nSubject: {sub}\n\n{snip}"
        )
        print("alerted:", frm, "|", sub)


if __name__ == "__main__":
    main()
