"""Fully automated Gmail re-consent. Drives the OAuth flow inside the
chrome-debug-profile (CDP :9229): opens the consent URL, auto-clicks the
account chooser, the 'unverified app' warning, scope checkboxes and the
Allow/Continue button, captures the code on the localhost callback, saves
the token and Telegrams the result.

Launched by daily-ops.py when the refresh token dies; also runnable manually:
    python auto-reauth.py
Falls back to a 'manual consent needed' Telegram message on failure."""

import json
import os
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

KEYS = "C:/Users/tbaltzakis/AppData/Roaming/devin/secrets"
DIR = os.path.dirname(os.path.abspath(__file__))
CLIENTS = json.load(open(r"C:\Users\tbaltzakis\.config\google-calendar-mcp\gcp-oauth.keys.json"))
CI = CLIENTS.get("installed") or CLIENTS.get("web")
REDIRECT = "http://localhost:50000/auth/callback"
SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
CDP = "http://localhost:9229"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PROFILE = r"C:\Users\tbaltzakis\chrome-debug-profile"
ACCOUNT = "baltzakis.themis"
TIMEOUT = 300  # seconds to complete the consent flow
CHAT_ID = "7017840434"
BOT = open(KEYS + "/tg-bot-token").read().strip()

code = {}


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        p = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if "code" in p:
            code["code"] = p["code"][0]
            self.send_response(200)
            self.wfile.write(b"<h2>OK</h2>")
        else:
            self.send_response(400)
            self.wfile.write(b"missing code")
        self.end_headers()

    def log_message(self, *a):
        pass


def tg(text):
    data = urllib.parse.urlencode({"chat_id": CHAT_ID, "text": text}).encode()
    try:
        urllib.request.urlopen(
            f"https://api.telegram.org/bot{BOT}/sendMessage", data=data, timeout=15
        )
    except Exception as e:
        print("tg err", e)


def http_json(url, method="GET"):
    return json.loads(
        urllib.request.urlopen(urllib.request.Request(url, method=method), timeout=10).read()
    )


def ensure_browser():
    try:
        http_json(CDP + "/json/version")
        return
    except Exception:
        pass
    subprocess.Popen(
        [
            CHROME,
            "--remote-debugging-port=9229",
            f"--user-data-dir={PROFILE}",
            "--no-first-run",
            "--no-default-browser-check",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(30):
        time.sleep(1)
        try:
            http_json(CDP + "/json/version")
            return
        except Exception:
            continue
    raise RuntimeError("debug chrome never came up")


CLICK_JS = """(()=>{
 const vis=e=>!!(e.offsetWidth||e.offsetHeight);
 const txt=e=>(e.innerText||e.textContent||'').trim();
 const all=[...document.querySelectorAll('div[data-identifier],button,a,div[role=button],div[role=link],span')];
 for(const e of all){const d=e.getAttribute('data-identifier');
   if(d&&d.includes('ACCOUNT_PLACEHOLDER')){e.click();return 'acct'}}
 for(const cb of document.querySelectorAll('input[type=checkbox]:not(:checked)')){cb.click()}
 for(const e of all){const t=txt(e);
   if(vis(e)&&['Continue','Allow','Συνέχεια','Αποδοχή','Επιτρέπω','Next','Επόμενο'].includes(t)){e.click();return 'btn:'+t}}
 for(const e of all){const t=txt(e);
   if(vis(e)&&/unsafe|μη ασφαλ/i.test(t)){e.click();return 'go:'+t}}
 for(const e of all){const t=txt(e);
   if(vis(e)&&/^(Advanced|Σύνθετη|Επιπλέον|More options)$/i.test(t)){e.click();return 'adv:'+t}}
 return ''})()"""


def eval_tab(ws_url, expr):
    import websocket

    ws = websocket.create_connection(ws_url, timeout=20, suppress_origin=True)
    mid = [0]

    def send(m, p=None):
        mid[0] += 1
        ws.send(json.dumps({"id": mid[0], "method": m, "params": p or {}}))
        return mid[0]

    rid = send("Runtime.evaluate", {"expression": expr, "returnByValue": True})
    deadline = time.time() + 25
    while time.time() < deadline:
        m = json.loads(ws.recv())
        if m.get("id") == rid:
            ws.close()
            return m.get("result", {}).get("result", {}).get("value")
    ws.close()
    return None


def consent_tab():
    for t in http_json(CDP + "/json/list"):
        if t.get("type") == "page" and (
            "accounts.google.com" in t.get("url", "") or "localhost:50000" in t.get("url", "")
        ):
            return t
    return None


deadline = 0


def main():
    global deadline
    deadline = time.time() + TIMEOUT
    ensure_browser()
    srv = HTTPServer(("127.0.0.1", 50000), H)
    srv.timeout = 5

    def serve():
        while "code" not in code and time.time() < deadline:
            srv.handle_request()  # returns each request or every 5s on timeout

    threading.Thread(target=serve, daemon=True).start()

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
    http_json(CDP + "/json/new?" + urllib.parse.quote(url, safe=""), method="PUT")

    def drive(tab):
        # account chooser ignores synthetic .click() -> real mouse events
        # via cdp.py; consent buttons respond to JS clicks (CLICK_JS).
        if "accountchooser" in (tab.get("url") or ""):
            try:
                import cdp

                t = cdp.for_url("accountchooser")
                if t:
                    info = t.click_text(ACCOUNT, tags="li,button,[role=button],[role=link]")
                    t.close()
                    return "acct " + str(info) if info else ""
            except Exception as e:
                print("cdp acct click err", e)
            return ""
        return eval_tab(
            tab["webSocketDebuggerUrl"], CLICK_JS.replace("ACCOUNT_PLACEHOLDER", ACCOUNT)
        )

    last = ""
    while time.time() < deadline and "code" not in code:
        tab = consent_tab()
        if tab:
            clicked = drive(tab)
            if clicked and clicked != last:
                print("clicked:", clicked)
            last = clicked or last
        time.sleep(2)
    if "code" not in code:
        # consent screens couldn't be completed — likely the Google session
        # in the debug profile died. Try automated sign-in, then retry once.
        print("consent timed out — attempting google-login then one retry")
        deadline = time.time() + 420  # keep the callback server alive
        try:
            import subprocess

            subprocess.run([sys.executable, os.path.join(DIR, "google-login.py")], timeout=300)
        except Exception as e:
            print("google-login err", e)
        # one retry of the consent flow
        deadline = time.time() + 120
        tab = None
        while time.time() < deadline and "code" not in code:
            tab = consent_tab()
            if tab:
                clicked = drive(tab)
                if clicked:
                    print("retry clicked:", clicked)
            time.sleep(2)
    srv.server_close()

    if "code" not in code:
        tg(
            "Gmail auto-reauth could not complete even after automated "
            "Google sign-in.\nPlease approve manually: run gmail_auth.py "
            "and click through (pick " + ACCOUNT + "@gmail.com)."
        )
        raise SystemExit("consent flow timed out")

    data = urllib.parse.urlencode(
        {
            "code": code["code"],
            "client_id": CI["client_id"],
            "client_secret": CI["client_secret"],
            "redirect_uri": REDIRECT,
            "grant_type": "authorization_code",
        }
    ).encode()
    n = json.loads(urllib.request.urlopen(CI["token_uri"], data=data).read())
    if "refresh_token" not in n:
        tg("Gmail auto-reauth: token exchange returned no refresh_token: " + json.dumps(n)[:200])
        raise SystemExit("no refresh_token")
    n["expires_at"] = time.time() + n["expires_in"] - 60
    if "refresh_token_expires_in" in n:
        n["refresh_expires_at"] = time.time() + n["refresh_token_expires_in"] - 3600
    json.dump(n, open(KEYS + "/gmail-token.json", "w"))

    tab = consent_tab()
    if tab:
        try:
            http_json(CDP + "/json/close/" + tab["id"])
        except Exception:
            pass
    tg("Gmail token auto-renewed — all watchers are healthy again.")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        print("err", e)
        tg("Gmail auto-reauth error: " + str(e) + "\nManual fallback: run gmail_auth.py.")
