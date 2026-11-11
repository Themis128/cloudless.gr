"""Fetch the newest Gmail message matching a query — body text + attachments.

usage:
  python gmail-fetch.py "from:sofiakakkava.com newer_than:30d" [--all]
  python gmail-fetch.py "<query>" --save C:/path/to/dir

Prints From/Subject/Date/snippet and saves attachments under --save dir
(default: ./gmail-fetch-out next to this script). --all fetches every
match (newest first), not just the latest."""

import base64
import io
import json
import os
import sys
import urllib.parse
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

KEYS = "C:/Users/tbaltzakis/AppData/Roaming/devin/secrets"
DIR = os.path.dirname(os.path.abspath(__file__))


def gmail_token():
    t = json.load(open(KEYS + "/gmail-token.json"))
    if t.get("expires_at", 0) < __import__("time").time():
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
        t["expires_at"] = __import__("time").time() + n["expires_in"] - 60
        if "refresh_token_expires_in" in n:
            t["refresh_expires_at"] = (
                __import__("time").time() + n["refresh_token_expires_in"] - 3600
            )
        json.dump(t, open(KEYS + "/gmail-token.json", "w"))
    return t["access_token"]


def api(path):
    r = urllib.request.Request(
        "https://gmail.googleapis.com/gmail/v1/users/me/" + path,
        headers={"Authorization": "Bearer " + gmail_token()},
    )
    return json.loads(urllib.request.urlopen(r, timeout=30).read())


def header(m, name):
    return next(
        (h["value"] for h in m["payload"]["headers"] if h["name"].lower() == name.lower()), ""
    )


def body_text(payload):
    """Extract plain text body, recursively."""
    if payload.get("mimeType") == "text/plain" and payload.get("body", {}).get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", "replace")
    for part in payload.get("parts", []):
        t = body_text(part)
        if t:
            return t
    return ""


def attachments(payload, out):
    """Save any attachment parts; returns list of filenames."""
    saved = []
    if payload.get("filename") and payload.get("body", {}).get("attachmentId"):
        att = api(f"messages/{payload.get('_mid')}/attachments/{payload['body']['attachmentId']}")
        data = base64.urlsafe_b64decode(att["data"])
        path = os.path.join(out, payload["filename"])
        open(path, "wb").write(data)
        saved.append(path)
    for part in payload.get("parts", []):
        saved += attachments(part, out)
    return saved


def main():
    argv = sys.argv[1:]
    query = next((a for a in argv if not a.startswith("--")), None)
    if not query:
        print(__doc__)
        sys.exit(2)
    all_msgs = "--all" in argv
    out = (
        argv[argv.index("--save") + 1] if "--save" in argv else os.path.join(DIR, "gmail-fetch-out")
    )
    os.makedirs(out, exist_ok=True)

    res = api(
        "messages?q=" + urllib.parse.quote(query) + "&maxResults=" + ("50" if all_msgs else "1")
    )
    msgs = res.get("messages", [])
    if not msgs:
        print("no matches for:", query)
        return

    for m in msgs:
        full = api("messages/" + m["id"] + "?format=full")
        full["payload"].get("headers", [])  # noop
        p = full["payload"]

        # stash message id into payload for attachment fetch
        def mark(pl, mid=full["id"]):
            pl["_mid"] = mid
            for part in pl.get("parts", []):
                mark(part)

        mark(p)
        print("=" * 60)
        print("From:   ", header(full, "From"))
        print("To:     ", header(full, "To"))
        print("Subject:", header(full, "Subject"))
        print("Date:   ", header(full, "Date"))
        print("Snippet:", full.get("snippet", ""))
        txt = body_text(p)
        if txt:
            print("-" * 60)
            print(txt[:4000] + ("\n...[truncated]" if len(txt) > 4000 else ""))
        saved = attachments(p, out)
        for s in saved:
            print("ATTACHMENT SAVED:", s)
        if not all_msgs:
            break


if __name__ == "__main__":
    main()
