"""SKC (Sofia Kakkava Coaching) Offer Audit reply watcher (one-shot, run via schtasks).
Alerts on Telegram when any new mail arrives from @sofiakakkava.com
(the Offer Audit Report response expected ~10 business days after 2026-11-08).
State kept in skc-state.json next to this file."""

import json
import os
import re
import time
import urllib.parse
import urllib.request
from email.header import decode_header, make_header

KEYS = "C:/Users/tbaltzakis/AppData/Roaming/devin/secrets"
DIR = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(DIR, "skc-state.json")
CHAT_ID = "7017840434"
BOT = open(KEYS + "/tg-bot-token").read().strip()
QUERY = "from:sofiakakkava.com newer_than:90d"


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
    st = json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {}

    q = urllib.parse.quote(QUERY)
    res = api(f"messages?q={q}&maxResults=20")
    msgs = res.get("messages", [])
    if not msgs:
        print("no SKC mail found")
        return

    # baseline: record every current message id; alert only on ids not seen before
    fresh = [m for m in msgs if m["id"] not in st.get("seen", [])]
    if "seen" not in st:
        st["seen"] = [m["id"] for m in msgs]
        json.dump(st, open(STATE, "w", encoding="utf-8"))
        print("baseline", len(msgs), "msgs")
        return

    if not fresh:
        print("no new mail", time.strftime("%H:%M"))
        return

    for m in fresh:
        full = api(
            "messages/"
            + m["id"]
            + "?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date"
        )
        frm = header(full, "From")
        sub = dec(header(full, "Subject"))
        dt = header(full, "Date")
        if is_otp(sub):
            # Never broadcast the snippet — it contains the live code.
            print("skipped OTP mail:", frm, "|", sub)
            continue
        snip = full.get("snippet", "")[:400]
        tg(f"SKC / Offer Audit mail arrived!\n\nFrom: {frm}\nSubject: {sub}\nDate: {dt}\n\n{snip}")
        print("alerted:", sub)

    st["seen"] = [m["id"] for m in msgs]
    json.dump(st, open(STATE, "w", encoding="utf-8"))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("err", e)
        st = json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {}
        if not st.get("err_alert") or time.time() - st["err_alert"] > 86400:
            try:
                tg(f"SKC watch error: {e}")
                st["err_alert"] = time.time()
                json.dump(st, open(STATE, "w", encoding="utf-8"))
            except Exception:
                pass
