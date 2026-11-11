"""Daily ops check (run via schtasks once a day):
1. Gmail token health — warns on Telegram ~2 days before the OAuth refresh
   token expires (Testing-mode apps die ~every 7 days) and immediately if
   a refresh attempt fails. Re-auth fix: run gmail_auth.py and approve in browser.
2. SKC Offer Audit workflow reminders — submission deadline, expected report
   window, and follow-up nudge.
State kept in daily-ops-state.json next to this file (which alerts already sent)."""

import datetime
import json
import os
import sys
import time
import urllib.parse
import urllib.request

KEYS = "C:/Users/tbaltzakis/AppData/Roaming/devin/secrets"
DIR = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(DIR, "daily-ops-state.json")
CHAT_ID = "7017840434"
BOT = open(KEYS + "/tg-bot-token").read().strip()


def tg(text):
    data = urllib.parse.urlencode({"chat_id": CHAT_ID, "text": text}).encode()
    urllib.request.urlopen(f"https://api.telegram.org/bot{BOT}/sendMessage", data=data, timeout=15)


def load_state():
    return json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {}


def save_state(st):
    json.dump(st, open(STATE, "w", encoding="utf-8"))


def once(st, key, text):
    if key not in st.get("sent", []):
        tg(text)
        st.setdefault("sent", []).append(key)
        print("sent:", key)


def token_check(st):
    t = json.load(open(KEYS + "/gmail-token.json"))
    now = time.time()
    # proactively refresh if access token is expired/near expiry
    if t.get("expires_at", 0) < now + 300:
        try:
            k = json.load(
                open(r"C:\Users\tbaltzakis\.config\google-calendar-mcp\gcp-oauth.keys.json")
            )
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
            t["expires_at"] = now + n["expires_in"] - 60
            if "refresh_token_expires_in" in n:
                t["refresh_expires_at"] = now + n["refresh_token_expires_in"] - 3600
            json.dump(t, open(KEYS + "/gmail-token.json", "w"))
            # clear the dead-token alert so a future failure re-notifies
            st["sent"] = [k for k in st.get("sent", []) if k != "token-dead"]
            print("token refreshed")
        except Exception as e:
            once(
                st,
                "token-dead",
                f"Gmail token refresh FAILED ({e}).\n"
                "Auto-reauth is running in the debug Chrome — if it can't "
                "finish the consent screens you'll get another message.",
            )
            # fully automated re-consent in chrome-debug-profile (CDP :9229);
            # falls back to a manual-approval Telegram nudge on failure
            try:
                import subprocess

                subprocess.Popen(
                    [
                        sys.executable.replace("pythonw", "python"),
                        os.path.join(DIR, "auto-reauth.py"),
                    ],
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
                )
                print("auto-launched auto-reauth.py")
            except Exception as e2:
                print("auth auto-launch err", e2)
            return
    exp = t.get("refresh_expires_at")
    if exp:
        days = (exp - now) / 86400
        if days <= 2:
            once(
                st,
                f"token-expiry-{int(exp)}",
                f"Gmail watch token expires in ~{days:.1f} days "
                f"({datetime.datetime.fromtimestamp(exp):%Y-%m-%d %H:%M}).\n"
                "Re-auth soon: run gmail_auth.py, approve in browser.",
            )
        elif days <= 6:
            print(f"token ok, {days:.1f}d left")
    # proactive re-consent: fire auto-reauth ~36h before expiry so the
    # consent screens get clicked while watchers still work, not after death
    if exp and exp - now < 36 * 3600 and exp - now > 0:
        once(
            st,
            f"proactive-reauth-{int(exp)}",
            "Gmail token expires in <36h — launching auto-reauth now.",
        )
        try:
            import subprocess

            subprocess.Popen(
                [sys.executable.replace("pythonw", "python"), os.path.join(DIR, "auto-reauth.py")],
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
            )
            print("launched proactive auto-reauth.py")
        except Exception as e2:
            print("proactive reauth launch err", e2)


def skc_reminders(st, today):
    d = today.date() if hasattr(today, "date") else today
    # submission deadline 2026-11-12 (materials already sent, but warn anyway)
    for dd, msg in [
        (
            "2026-11-10",
            "SKC Offer Audit: submission deadline is Nov 12. Confirm your materials email reached community@sofiakakkava.com.",
        ),
        ("2026-11-11", "LAST CALL: SKC Offer Audit materials due tomorrow (Nov 12)."),
        (
            "2026-11-23",
            "Expected window: SKC said the Offer Audit Report arrives within 10 business days of submission (~Nov 23). Watch for mail from @sofiakakkava.com.",
        ),
        (
            "2026-11-25",
            "10 business days have passed since your SKC submission. If no Offer Audit Report arrived yet, follow up at community@sofiakakkava.com.",
        ),
        (
            "2026-12-02",
            "Still no SKC Offer Audit Report? Send a polite follow-up to community@sofiakakkava.com referencing your submission email.",
        ),
    ]:
        delta = (d - datetime.date.fromisoformat(dd)).days
        if 0 <= delta <= 2:
            once(st, f"skc-{dd}", "SKC reminder: " + msg)


ENV_PATH = r"\\wsl.localhost\Ubuntu-24.04\home\tbaltzakis\cu130-slim\.env"
ENV_REQUIRED = [
    "REDIS_PASSWORD",
    "SOCIAL_POSTGRES_PASSWORD",
    "ENCRYPTION_KEY",
    "N8N_API_KEY",
    "AUTHENTIK_CLIENT_SECRET",
]
ENV_MIN_LINES = 200  # real file is ~280 lines; the 2026-11-08 stub was 8


def env_guard(st):
    """Alert if the cu130-slim .env was clobbered/truncated — a stub env once
    killed ~20 containers (stale bind mounts + compose interpolation fails)."""
    try:
        txt = open(ENV_PATH, encoding="utf-8").read()
    except Exception as e:
        once(st, "env-missing", f"cu130-slim .env UNREADABLE ({e}) — stack may fail to start.")
        return
    keys = {
        line.split("=", 1)[0]
        for line in txt.splitlines()
        if "=" in line and not line.startswith("#")
    }
    missing = [k for k in ENV_REQUIRED if k not in keys]
    n = len(txt.splitlines())
    if missing or n < ENV_MIN_LINES:
        once(
            st,
            f"env-bad-{n}-{','.join(missing)}",
            f"cu130-slim .env looks TRUNCATED ({n} lines, missing: {', '.join(missing) or 'none-key-level'}).\n"
            "Restore from C:\\Users\\tbaltzakis\\cu130-slim\\.env then "
            "`docker compose up -d` in ~/cu130-slim — stale mounts need recreate.",
        )
    else:
        print(f"env ok ({n} lines)")


def main():
    st = load_state()
    try:
        env_guard(st)
    except Exception as e:
        print("env_guard err", e)
    try:
        token_check(st)
    except Exception as e:
        print("token_check err", e)
    try:
        skc_reminders(st, datetime.datetime.now())
    except Exception as e:
        print("skc_reminders err", e)
    save_state(st)
    print("done", time.strftime("%Y-%m-%d %H:%M"))


if __name__ == "__main__":
    main()
