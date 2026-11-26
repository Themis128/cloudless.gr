"""Fetch the newest Gmail message matching a query and file it under
Documents\\dypa-1000-ptyxiouxon as a dated .txt.

usage: python file-mail.py ["<gmail query>"] [--out DIR] [--save-attachments]

Defaults: query 'da2@dypa.gov.gr OR dypa.gov.gr newer_than:30d',
out = C:/Users/tbaltzakis/Documents/dypa-1000-ptyxiouxon

Reuses gmail-fetch.py's auth/API helpers by exec'ing it is fragile, so this
script talks to the Gmail API directly with the same token files.
"""

import argparse
import base64
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from email.header import decode_header, make_header

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

KEYS = "C:/Users/tbaltzakis/AppData/Roaming/devin/secrets"
GKEYS = r"C:\Users\tbaltzakis\.config\google-calendar-mcp\gcp-oauth.keys.json"
DEFAULT_OUT = r"C:\Users\tbaltzakis\Documents\dypa-1000-ptyxiouxon"
API = "https://gmail.googleapis.com/gmail/v1/users/me/"


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
    r = urllib.request.Request(API + path, headers={"Authorization": "Bearer " + gmail_token()})
    return json.loads(urllib.request.urlopen(r, timeout=30).read())


def header(msg, name):
    return next(
        (h["value"] for h in msg["payload"]["headers"] if h["name"].lower() == name.lower()), ""
    )


def dec(raw):
    try:
        return str(make_header(decode_header(raw or "")))
    except Exception:
        return raw or ""


def body_text(payload):
    """Best-effort plain-text body extraction."""
    out = []

    def walk(p):
        mt = p.get("mimeType", "")
        data = p.get("body", {}).get("data")
        if mt == "text/plain" and data:
            out.append(base64.urlsafe_b64decode(data + "===").decode("utf-8", "replace"))
        for part in p.get("parts", []):
            walk(part)

    walk(payload)
    if out:
        return "\n".join(out)
    # fallback: strip tags from text/html
    html = []

    def walkh(p):
        data = p.get("body", {}).get("data")
        if p.get("mimeType", "").startswith("text/html") and data:
            html.append(base64.urlsafe_b64decode(data + "===").decode("utf-8", "replace"))
        for part in p.get("parts", []):
            walkh(part)

    walkh(payload)
    if html:
        txt = re.sub(r"<[^>]+>", " ", " ".join(html))
        return re.sub(r"\s+", " ", txt).strip()
    return "(no body)"


def slug(s, n=40):
    s = re.sub(r"[^\w\-]+", "-", s, flags=re.UNICODE).strip("-").lower()
    return s[:n] or "mail"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("query", nargs="?", default="da2@dypa.gov.gr OR dypa.gov.gr newer_than:30d")
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--save-attachments", action="store_true")
    args = ap.parse_args()

    msgs = api("messages?q=" + urllib.parse.quote(args.query) + "&maxResults=1").get("messages", [])
    if not msgs:
        print("no matching message")
        sys.exit(1)
    m = api("messages/" + msgs[0]["id"] + "?format=full")

    date = header(m, "Date")
    mdate = re.search(r"(\d{1,2})\s+(\w{3})\s+(\d{4})", date)
    months = {
        "Jan": 1,
        "Feb": 2,
        "Mar": 3,
        "Apr": 4,
        "May": 5,
        "Jun": 6,
        "Jul": 7,
        "Aug": 8,
        "Sep": 9,
        "Oct": 10,
        "Nov": 11,
        "Dec": 12,
    }
    ymd = "undated"
    if mdate and mdate.group(2) in months:
        ymd = f"{mdate.group(3)}-{months[mdate.group(2)]:02d}-{int(mdate.group(1)):02d}"

    subj = dec(header(m, "Subject"))
    os.makedirs(args.out, exist_ok=True)
    path = os.path.join(args.out, f"{ymd}_{slug(subj)}.txt")

    with open(path, "w", encoding="utf-8") as f:
        f.write(f"Από: {dec(header(m, 'From'))}\n")
        f.write(f"Προς: {dec(header(m, 'To'))}\n")
        f.write(f"Κοινοποίηση: {dec(header(m, 'Cc'))}\n")
        f.write(f"Ημερομηνία: {date}\n")
        f.write(f"Θέμα: {subj}\n\n")
        f.write(body_text(m["payload"]))
        f.write("\n")

    saved = [path]
    if args.save_attachments:
        for part in m["payload"].get("parts", []):
            fn = part.get("filename")
            att = part.get("body", {}).get("attachmentId")
            if fn and att:
                data = api(f"messages/{m['id']}/attachments/{att}")
                apath = os.path.join(args.out, f"{ymd}_{fn}")
                with open(apath, "wb") as f:
                    f.write(base64.urlsafe_b64decode(data["data"] + "==="))
                saved.append(apath)

    git_sync(args.out, ymd, subj)
    print("filed:", *saved, sep="\n  ")


def git_sync(out_dir, ymd, subj):
    """Commit+push newly filed mail if out_dir is a git repo with a remote."""

    def git(*a):
        return subprocess.run(
            ["git", "-C", out_dir, *a], capture_output=True, text=True, timeout=60
        )

    if git("rev-parse", "--git-dir").returncode != 0:
        return
    if not git("remote").stdout.strip():
        return
    if git("status", "--porcelain").stdout.strip() == "":
        return
    git("add", "-A")
    msg = f"mail {ymd}: {subj[:80]}"
    r = git("commit", "-m", msg)
    if r.returncode != 0:
        print("git commit failed:", r.stderr.strip()[:200])
        return
    p = git("push")
    print("git:", "pushed" if p.returncode == 0 else "push failed: " + p.stderr.strip()[:200])


if __name__ == "__main__":
    main()
