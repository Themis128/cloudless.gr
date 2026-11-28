"""Iordanakeion (Rafaela's school) canteen-menu watchdog — one-shot, schtasks.

Each weekday morning checks whether the epafos/SimpleSchool portal sent the
«Γεγονός» canteen-menu mail covering the NEXT school day (the observed pattern:
the menu for day D is mailed on D-1 afternoon — e.g. Thu 26/11 mail announced
Fri 27/11's dish). If no mail covers the target date:

  1. Telegram alert to the ops chat.
  2. Auto-sends a follow-up email to contact@iordanakeion.gr asking whether the
     menu was published (once per target date — state file prevents repeats).

Runs Mon-Thu only (no expectation of a menu mail on Friday for Monday).
State: iordanakeion-menu-watch-state.json next to this file.
"""

import base64
import datetime as dt
import json
import os
import quopri
import re
import sys
import urllib.parse
import urllib.request
from email.header import decode_header, make_header
from email.mime.text import MIMEText

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, r"C:/Users/tbaltzakis/AppData/Roaming/devin/skills/gmail-local-mcp/scripts")
import gmail_mcp  # noqa: E402

KEYS = "C:/Users/tbaltzakis/AppData/Roaming/devin/secrets"
STATE = os.path.join(HERE, "iordanakeion-menu-watch-state.json")
BOT = open(KEYS + "/tg-bot-token").read().strip()
CHAT_ID = "7017840434"

SCHOOL = "contact@iordanakeion.gr"
FROM_ADDR = "baltzakis.themis@gmail.com"
FROM_NAME = "Themistoklis Baltzakis"
EPAFOS = "4schools-info@epafos.gr"

WEEKDAYS = ["Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο", "Κυριακή"]
MONTHS = {
    "Ιανουαρίου": 1,
    "Φεβρουαρίου": 2,
    "Μαρτίου": 3,
    "Απριλίου": 4,
    "Μαΐου": 5,
    "Ιουνίου": 6,
    "Ιουλίου": 7,
    "Αυγούστου": 8,
    "Σεπτεμβρίου": 9,
    "Οκτωβρίου": 10,
    "Νοεμβρίου": 11,
    "Δεκεμβρίου": 12,
}
DATE_RE = re.compile(
    r"(Δευτέρα|Τρίτη|Τετάρτη|Πέμπτη|Παρασκευή|Σάββατο|Κυριακή),\s*"
    r"(\d{1,2})\s+(Ιανουαρίου|Φεβρουαρίου|Μαρτίου|Απριλίου|Μαΐου|Ιουνίου|"
    r"Ιουλίου|Αυγούστου|Σεπτεμβρίου|Οκτωβρίου|Νοεμβρίου|Δεκεμβρίου)\s+(\d{4})"
)


def dec(raw):
    try:
        return str(make_header(decode_header(raw or "")))
    except Exception:
        return raw or ""


def header(m, name):
    return next(
        (h["value"] for h in m["payload"]["headers"] if h["name"].lower() == name.lower()),
        "",
    )


def body_text(m):
    """Extract readable text from the epafos HTML mail (raw or full format)."""
    raw = m.get("raw")
    if raw:
        data = base64.urlsafe_b64decode(raw).decode("utf-8", "replace")
    else:
        # format=full payload — find the text/html part
        parts = []

        def walk(p):
            if p.get("mimeType") in ("text/html", "text/plain"):
                parts.append(p)
            for sp in p.get("parts", []) or []:
                walk(sp)

        walk(m["payload"])
        if not parts:
            return ""
        data_b64 = parts[-1].get("body", {}).get("data")
        if not data_b64:
            return ""
        data = base64.urlsafe_b64decode(data_b64).decode("utf-8", "replace")
    if "quoted-printable" in data[:4000].lower() or "=CE" in data:
        try:
            data = quopri.decodestring(
                data[data.find("\n\n") + 2 :].encode("utf-8", "replace")
            ).decode("utf-8", "replace")
        except Exception:
            pass
    txt = re.sub(r"<style.*?</style>", "", data, flags=re.S)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = txt.replace("&nbsp;", " ").replace("&#32;", " ")
    return re.sub(r"\s+", " ", txt)


def covered_date(text):
    m = DATE_RE.search(text)
    if not m:
        return None
    wd, day, mon, year = m.groups()
    try:
        return dt.date(int(year), MONTHS[mon], int(day))
    except Exception:
        return None


def tg(text):
    data = urllib.parse.urlencode({"chat_id": CHAT_ID, "text": text}).encode()
    urllib.request.urlopen(f"https://api.telegram.org/bot{BOT}/sendMessage", data=data, timeout=15)


def send_mail(subject, body):
    msg = MIMEText(body, "plain", "utf-8")
    msg["From"] = f"{FROM_NAME} <{FROM_ADDR}>"
    msg["To"] = SCHOOL
    msg["Subject"] = subject
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    r = gmail_mcp.send_api("messages/send", {"raw": raw}, method="POST")
    return r.get("id")


def load():
    try:
        return json.load(open(STATE, encoding="utf-8"))
    except Exception:
        return {}


def save(st):
    tmp = STATE + ".tmp"
    json.dump(st, open(tmp, "w", encoding="utf-8"))
    os.replace(tmp, STATE)


def main():
    today = dt.date.today()
    if today.weekday() >= 4:  # Sat/Sun — and Friday: no next-day menu expected
        print("weekend/Friday — skip")
        return
    target = today + dt.timedelta(days=1)
    tname = WEEKDAYS[target.weekday()]

    st = load()
    if st.get("handled") == target.isoformat():
        print(f"already handled for {target} — skip")
        return

    # latest epafos school mails in the last 5 days
    q = urllib.parse.quote(f"from:{EPAFOS} newer_than:5d")
    msgs = gmail_mcp.READ_API(f"messages?q={q}&maxResults=10").get("messages", [])

    covered = set()
    for m in msgs:
        try:
            full = gmail_mcp.READ_API("messages/" + m["id"] + "?format=full")
            subj = dec(header(full, "Subject"))
            if "ΙΩΡΔΑΝΑΚΕΙΟΝ" not in subj.upper() and "Γεγονός" not in subj:
                continue
            d = covered_date(body_text(full))
            if d:
                covered.add(d)
        except Exception as e:
            print("msg err", m["id"], str(e)[:120])

    if target in covered:
        print(f"menu mail for {target} ({tname}) found — ok")
        return

    print(f"MISSING menu mail for {target} ({tname}); covered={sorted(map(str, covered))}")

    # 1) Telegram alert
    try:
        tg(
            "Ιορδανάκειο: ΔΕΝ ελήφθη ειδοποίηση μενού σίτισης για "
            f"{tname} {target.strftime('%d/%m')} (επανελέγχθηκε αυτόματα). "
            "Αποστέλλεται follow-up στο σχολείο."
        )
    except Exception as e:
        print("tg err", e)

    # 2) Auto follow-up to the school (once per target date)
    dd = target.strftime("%d/%m/%Y")
    wd_name = WEEKDAYS[today.weekday()]
    body = (
        "Αξιότιμοι/ές,\n\n"
        f"Είμαι ο Θεμιστοκλής Μπαλτζάκης, πατέρας της μαθήτριας Μπαλτζάκη "
        "Ραφαέλα (Τμήμα Β1).\n\n"
        f"Σήμερα {wd_name} {today.strftime('%d/%m/%Y')} δεν έλαβα την "
        f"ειδοποίηση «Γεγονός» με το πιάτο της ημέρας για την {tname} "
        f"{dd} από το 4schools/Επαφος.\n\n"
        "Θα ήθελα να ρωτήσω αν το μενού δημοσιεύτηκε κανονικά και απλώς "
        "δεν στάλθηκε η ειδοποίηση, ή αν δεν καταχωρήθηκε καθόλου. Αν "
        "υπάρχει, θα ήθελα να μάθω ποιο είναι το πιάτο, ώστε να ετοιμάσω "
        "κατάλληλα το παιδί.\n\n"
        "Ευχαριστώ εκ των προτέρων,\n"
        "Θεμιστοκλής Μπαλτζάκης\n"
        f"{FROM_ADDR}"
    )
    subj = f"Ερώτηση για το μενού σίτισης της {tname} {dd} — Μπαλτζάκη Ραφαέλα (Τμήμα Β1)"
    try:
        mid = send_mail(subj, body)
        print("follow-up sent:", mid)
        st["last_sent"] = {"target": target.isoformat(), "gmail_id": mid}
    except Exception as e:
        print("send err", e)
        st["last_error"] = str(e)

    st["handled"] = target.isoformat()
    st["checked_at"] = dt.datetime.now().isoformat(timespec="seconds")
    save(st)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("err", e)
        st = load()
        if st.get("err_alert") != dt.date.today().isoformat():
            try:
                tg(f"iordanakeion-menu-watch error: {e}")
                st["err_alert"] = dt.date.today().isoformat()
                save(st)
            except Exception:
                pass
