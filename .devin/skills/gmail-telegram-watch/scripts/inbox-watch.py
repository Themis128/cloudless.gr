"""Inbox reply watcher: alerts Telegram on ANY new inbox mail, minus the
authority domains already covered by case-watch.py and minus Gmail's
promotions/social/forums categories. One-shot per run via schtasks.
First run seeds the seen-set silently (no alert storm).
State: inbox-watch-state.json next to this file."""

import json
import os
import re
import time
import urllib.parse
import urllib.request
from email.header import decode_header, make_header

KEYS = "C:/Users/tbaltzakis/AppData/Roaming/devin/secrets"
GKEYS = r"C:\Users\tbaltzakis\.config\google-calendar-mcp\gcp-oauth.keys.json"
DIR = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(DIR, "inbox-watch-state.json")
CHAT_ID = "7017840434"
BOT = open(KEYS + "/tg-bot-token").read().strip()

# Everything in the inbox except the case-authority domains (case-watch.py)
# and Gmail's bulk categories.
QUERY = (
    "in:anywhere -in:sent newer_than:1d "
    "-category:promotions -category:social -category:forums "
    "-from:synigoros.gr -from:dypa.gov.gr -from:gov.gr "
    "-from:hli.gov.gr -from:yeka.gr -from:efka.gov.gr "
    "-from:micro1.ai"
)


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


def main():
    st = json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {}
    seen = set(st.get("seen", []))
    seeded = st.get("seeded", False)
    res = api("messages?q=" + urllib.parse.quote(QUERY) + "&maxResults=50")
    msgs = res.get("messages", [])
    fresh = []
    for m in msgs:
        if m["id"] in seen:
            continue
        seen.add(m["id"])
        if seeded:
            fresh.append(m["id"])
    st["seen"] = list(seen)[-1000:]
    st["seeded"] = True
    json.dump(st, open(STATE, "w", encoding="utf-8"))
    if not seeded or not fresh:
        print(f"[inbox] {'seeded' if not seeded else 'no new'} ({len(msgs)} matched)")
        return
    # fetch metadata only for fresh ids
    for mid in fresh[:20]:
        m = api(
            "messages/"
            + mid
            + "?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date"
        )
        frm = header(m, "From")
        sub = dec(header(m, "Subject"))
        if is_otp(sub):
            # Codes are machine-consumed (synigoros monitor, 2FA lanes) and
            # expire in minutes — alert that one arrived, never the code/snippet.
            tg(
                "🔐 Κωδικός επαλήθευσης ελήφθη (σώμα κρυμμένο):\n\nFrom: "
                + frm
                + "\nSubject: "
                + sub
                + "\n\nΆνοιξε το Gmail αν χρειαστεί."
            )
            continue
        tg(
            "📬 Νέο mail:\n\nFrom: "
            + frm
            + "\nDate: "
            + header(m, "Date")
            + "\nSubject: "
            + sub
            + "\n\n"
            + (m.get("snippet") or "")[:300]
        )
    print(f"[inbox] alerted {len(fresh)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("err", e)
        st = json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {}
        if time.time() - st.get("err_alert", 0) > 86400:
            try:
                tg("inbox-watch error: " + str(e))
                st["err_alert"] = time.time()
                json.dump(st, open(STATE, "w", encoding="utf-8"))
            except Exception:
                pass
