"""DYPA da2@dypa.gov.gr reply — draft now, send at scheduled time.

DEPRECATED for new sends — use gmail-send-ops/scripts/gmail-schedule-reply.py.
Kept for the 11/11 da2 reply audit trail (state: dypa-da2-reply-state.json).

usage:
  python dypa-da2-reply.py --draft     # create threaded Gmail draft, save id to state
  python dypa-da2-reply.py --send      # drafts.send the saved draft (Telegram result)
  python dypa-da2-reply.py --status    # show draft state

Token: %APPDATA%/devin/secrets/gmail-send-token.json (gmail.modify scope).
State: dypa-da2-reply-state.json next to this script.
"""

import base64
import io
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from email.header import Header
from email.mime.text import MIMEText
from email.utils import formataddr

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

KEYS = os.path.join(os.environ["APPDATA"], "devin", "secrets")
DIR = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(DIR, "dypa-da2-reply-state.json")
TOKEN_FILE = KEYS + "/gmail-send-token.json"
BOT = open(KEYS + "/tg-bot-token").read().strip()
CHAT_ID = "7017840434"

TO = "da2@dypa.gov.gr"
FROM = "baltzakis.themis@gmail.com"
SUBJECT = "Re: ΠΑΡΟΧΗ ΠΛΗΡΟΦΟΡΙΩΝ ΕΙΔΙΚΟ ΠΡΟΓΡΑΜΜΑ 1.000 ΠΤΥΧΙΟΥΧΩΝ"
IN_REPLY_TO = "<AM0PR04MB5123153BDBDB5A69ABE1C16DAA722@AM0PR04MB5123.eurprd04.prod.outlook.com>"
THREAD_ID = "1a1c452571a59de0"

BODY = """Αξιότιμες Κυρίες και Κύριοι,

Σας ευχαριστώ για την ενημέρωση.

Θα περιμένω να επικοινωνήσετε μαζί μου από τη Γραμματεία της Επιτροπής, προκειμένου να ενημερωθώ για τη διαδικασία της δομημένης συνέντευξης. Είμαι στη διάθεσή σας για οτιδήποτε χρειαστεί εκ των προτέρων.

Στοιχεία αίτησης: 19156/16/08/2026

Με εκτίμηση,
Μπαλτζάκης Θεμιστοκλής
"""

DOC_DIR = r"C:\Users\tbaltzakis\Documents\dypa-1000-ptyxiouxon"


def tg(text):
    data = urllib.parse.urlencode({"chat_id": CHAT_ID, "text": text}).encode()
    try:
        urllib.request.urlopen(
            f"https://api.telegram.org/bot{BOT}/sendMessage", data=data, timeout=15
        )
    except Exception as e:
        print("tg err", e)


def token():
    t = json.load(open(TOKEN_FILE))
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
        n = json.loads(urllib.request.urlopen(ci["token_uri"], data=data, timeout=30).read())
        t.update(n)
        t["expires_at"] = time.time() + n["expires_in"] - 60
        if "refresh_token_expires_in" in n:
            t["refresh_expires_at"] = time.time() + n["refresh_token_expires_in"] - 3600
        json.dump(t, open(TOKEN_FILE, "w"))
    return t["access_token"]


def api(method, path, payload=None):
    req = urllib.request.Request(
        "https://gmail.googleapis.com/gmail/v1/users/me/" + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        method=method,
        headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json"},
    )
    return json.loads(urllib.request.urlopen(req, timeout=30).read())


def raw_message():
    msg = MIMEText(BODY, "plain", "utf-8")
    msg["From"] = formataddr(("Themistoklis Baltzakis", FROM))
    msg["To"] = TO
    msg["Subject"] = Header(SUBJECT, "utf-8")
    msg["In-Reply-To"] = IN_REPLY_TO
    msg["References"] = IN_REPLY_TO
    return base64.urlsafe_b64encode(msg.as_bytes()).decode()


def load_state():
    return json.load(open(STATE)) if os.path.exists(STATE) else {}


def save_state(st):
    json.dump(st, open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


def file_copy(tag):
    os.makedirs(DOC_DIR, exist_ok=True)
    p = os.path.join(DOC_DIR, time.strftime("%Y-%m-%d") + "_da2-reply-" + tag + ".txt")
    with open(p, "w", encoding="utf-8") as f:
        f.write(
            f"Από: {FROM}\nΠρος: {TO}\nΘέμα: {SUBJECT}\n"
            f"Ημερομηνία: {time.strftime('%Y-%m-%d %H:%M')}\n\n{BODY}"
        )
    return p


def do_draft():
    st = load_state()
    if st.get("draft_id"):
        # verify still exists
        try:
            api("GET", "drafts/" + st["draft_id"])
            print("draft already exists:", st["draft_id"])
            return
        except Exception:
            pass
    raw = raw_message()
    d = api("POST", "drafts", {"message": {"raw": raw, "threadId": THREAD_ID}})
    st.update(
        {
            "draft_id": d["id"],
            "message_id": d.get("message", {}).get("id"),
            "thread_id": THREAD_ID,
            "created": time.time(),
        }
    )
    save_state(st)
    file_copy("draft")
    tg(
        f"DYPA da2 reply: draft created in Gmail Drafts (id {d['id']}).\n"
        "Scheduled auto-send 12/11 10:00 — delete the draft or reply here to cancel."
    )
    print("draft:", d["id"], "msg:", st["message_id"])


def do_send():
    st = load_state()
    did = st.get("draft_id")
    if not did:
        tg("DYPA da2 reply: NO DRAFT FOUND — nothing sent. Check dypa-da2-reply-state.json")
        raise SystemExit("no draft_id in state")
    try:
        d = api("POST", "drafts/send", {"id": did})
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        tg(f"DYPA da2 reply FAILED: HTTP {e.code} {did}\n{body}")
        raise
    st["sent_at"] = time.time()
    st["sent_message_id"] = d.get("id")
    save_state(st)
    p = file_copy("sent")
    tg(f"DYPA da2 reply SENT to da2@dypa.gov.gr (msg {d.get('id')}).\nFiled: {p}")
    print("sent:", d.get("id"))


def do_status():
    st = load_state()
    print(json.dumps(st, ensure_ascii=False, indent=2))
    if st.get("draft_id"):
        try:
            d = api("GET", "drafts/" + st["draft_id"])
            print("draft still present, thread:", d.get("message", {}).get("threadId"))
        except Exception as e:
            print("draft gone or error:", e)


if __name__ == "__main__":
    if "--draft" in sys.argv:
        do_draft()
    elif "--send" in sys.argv:
        do_send()
    elif "--status" in sys.argv:
        do_status()
    else:
        print(__doc__)
