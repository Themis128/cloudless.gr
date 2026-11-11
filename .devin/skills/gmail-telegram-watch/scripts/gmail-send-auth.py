"""Automated gmail.modify re-consent for gmail-send-token.json.

Drives chrome-debug-profile (:9229) through the OAuth consent flow using
cdp.py. Quirks handled (verified 2026-11-11):
  - account chooser: synthetic .click() ignored -> real mouse events
  - legacy consent "Allow" button: CDP mouse ignored -> JS el.click()

Run:  python gmail-send-auth.py
Needs: chrome-debug on :9229 with a live Google session for
       baltzakis.themis@gmail.com (chains into google-login.py on failure).
"""

import json
import os
import subprocess
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cdp  # noqa: E402

KEYS = "C:/Users/tbaltzakis/AppData/Roaming/devin/secrets"
DIR = os.path.dirname(os.path.abspath(__file__))
CLIENTS = json.load(open(r"C:\Users\tbaltzakis\.config\google-calendar-mcp\gcp-oauth.keys.json"))
CI = CLIENTS.get("installed") or CLIENTS.get("web")
REDIRECT = "http://localhost:50000/auth/callback"
SCOPE = "https://www.googleapis.com/auth/gmail.modify"
TOKEN_OUT = KEYS + "/gmail-send-token.json"
CODE_FILE = KEYS + "/gmail-send-code.txt"
ACCOUNT = "baltzakis.themis"
TIMEOUT = 300
CHAT_ID = "7017840434"
BOT = open(KEYS + "/tg-bot-token").read().strip()


def tg(text):
    data = urllib.parse.urlencode({"chat_id": CHAT_ID, "text": text}).encode()
    try:
        urllib.request.urlopen(
            f"https://api.telegram.org/bot{BOT}/sendMessage", data=data, timeout=15
        )
    except Exception as e:
        print("tg err", e)


def start_callback():
    if os.path.exists(CODE_FILE):
        os.remove(CODE_FILE)
    return subprocess.Popen(
        [sys.executable, os.path.join(DIR, "oauth-callback-once.py")],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def code_ready():
    return os.path.exists(CODE_FILE) and os.path.getsize(CODE_FILE) > 10


def drive_tab(tab, url):
    """One poll iteration on the consent tab. Returns action taken."""
    u = tab.js("location.href") or ""
    if "accountchooser" in u or "signin/oauth" in u and "consent" not in u:
        info = tab.click_text(ACCOUNT, tags="li,button,[role=button],[role=link]")
        return "acct " + str(info) if info else "acct-wait"
    # consent / warning screens
    r = tab.js("""(()=>{
 const vis=e=>!!(e.offsetWidth||e.offsetHeight);
 const t=e=>(e.innerText||'').trim();
 const all=[...document.querySelectorAll('button,[role=button],a,div[role=link],input[type=checkbox]')];
 for(const e of all){ if(vis(e)&&/^(Allow|Συνέχεια|Continue|Next|Επόμενο|Accept|Επιτρέπω)$/i.test(t(e))){e.click();return 'btn:'+t(e)} }
 for(const e of all){ if(vis(e)&&/unsafe|not verified|δεν έχει επαληθευτεί|advanced|προχωρημένα|more options/i.test(t(e))){e.click();return 'warn:'+t(e).slice(0,40)} }
 for(const cb of document.querySelectorAll('input[type=checkbox]:not(:checked)')){cb.click()}
 return ''})()""")
    return "js:" + str(r) if r else "consent-wait"


def main():
    cb = start_callback()
    try:
        url = (
            CI["auth_uri"]
            + "?"
            + urllib.parse.urlencode(
                {
                    "client_id": CI["client_id"],
                    "redirect_uri": REDIRECT,
                    "response_type": "code",
                    "scope": SCOPE,
                    "access_type": "offline",
                    "prompt": "consent",
                }
            )
        )
        cdp.open_tab(url)
        deadline = time.time() + TIMEOUT
        last = ""
        while time.time() < deadline and not code_ready():
            tab = cdp.for_url("accounts.google.com")
            if tab:
                try:
                    act = drive_tab(tab, url)
                    if act != last:
                        print(time.strftime("%H:%M:%S"), act, flush=True)
                    last = act
                finally:
                    tab.close()
            time.sleep(2)
        if not code_ready():
            tg(
                "gmail-send-auth: consent timed out — Google session in debug "
                "Chrome may be dead. Run google-login.py then retry."
            )
            raise SystemExit("consent timed out")

        code = open(CODE_FILE).read().strip()
        data = urllib.parse.urlencode(
            {
                "code": code,
                "client_id": CI["client_id"],
                "client_secret": CI["client_secret"],
                "redirect_uri": REDIRECT,
                "grant_type": "authorization_code",
            }
        ).encode()
        n = json.loads(urllib.request.urlopen(CI["token_uri"], data=data, timeout=30).read())
        if "refresh_token" not in n:
            tg("gmail-send-auth: no refresh_token in exchange: " + json.dumps(n)[:200])
            raise SystemExit("no refresh_token")
        n["expires_at"] = time.time() + n["expires_in"] - 60
        if "refresh_token_expires_in" in n:
            n["refresh_expires_at"] = time.time() + n["refresh_token_expires_in"] - 3600
        json.dump(n, open(TOKEN_OUT, "w"))
        print("token saved:", TOKEN_OUT, "scope:", n.get("scope"))
        tg("gmail-send-auth OK — gmail-send-token.json renewed (gmail.modify).")
    finally:
        cb.terminate()
        try:
            os.remove(CODE_FILE)
        except OSError:
            pass


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        print("err", e)
        tg("gmail-send-auth error: " + str(e)[:200])
        raise
