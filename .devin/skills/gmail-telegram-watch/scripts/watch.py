"""Gmail -> Telegram watcher: polls for new micro1 mail, posts to Telegram.
usage: TG_CHAT_ID=<id> python watch.py [interval-sec]"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

KEYS = "C:/Users/tbaltzakis/AppData/Roaming/devin/secrets"
BOT = open(KEYS + "/tg-bot-token").read().strip()
CHAT = os.environ.get("TG_CHAT_ID")
if not CHAT:
    print("set TG_CHAT_ID")
    sys.exit(1)


def gmail_token():
    t = json.load(open(KEYS + "/gmail-token.json"))
    # refresh if expired
    if t.get("expires_at", 0) < time.time():
        k = json.load(open(KEYS + "/gcp-oauth.keys.json"))
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


seen = set()
INTV = int(sys.argv[1]) if len(sys.argv) > 1 else 300
while True:
    try:
        r = urllib.request.Request(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=from:micro1.ai+newer_than:1d&maxResults=5",
            headers={"Authorization": "Bearer " + gmail_token()},
        )
        ids = [m["id"] for m in json.loads(urllib.request.urlopen(r).read()).get("messages", [])]
        for mid in ids:
            if mid in seen:
                continue
            r = urllib.request.Request(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{mid}?format=metadata&metadataHeaders=Subject&metadataHeaders=From",
                headers={"Authorization": "Bearer " + gmail_token()},
            )
            m = json.loads(urllib.request.urlopen(r).read())
            sub = next((h["value"] for h in m["payload"]["headers"] if h["name"] == "Subject"), "")
            txt = urllib.parse.quote(f"micro1 mail: {sub}")
            urllib.request.urlopen(
                f"https://api.telegram.org/bot{BOT}/sendMessage?chat_id={CHAT}&text={txt}"
            )
            seen.add(mid)
    except Exception as e:
        print("err", e)
    time.sleep(INTV)
