"""Automated Google sign-in for chrome-debug-profile (CDP :9229).

Used when the Google session dies and auto-reauth.py hits a login wall.
Drives accounts.google.com: email -> password -> best-effort 2FA
(Authenticator TOTP if secrets/google-totp-secret exists, else phone
prompt -> Telegram fallback asking for one tap).

Secrets (never in repo):
  %APPDATA%/devin/secrets/google-password
  %APPDATA%/devin/secrets/google-totp-secret   (optional otpauth secret)

usage: python google-login.py"""

import json
import os
import subprocess
import time
import urllib.parse
import urllib.request

KEYS = "C:/Users/tbaltzakis/AppData/Roaming/devin/secrets"
DIR = os.path.dirname(os.path.abspath(__file__))
EMAIL = "baltzakis.themis@gmail.com"
CDP = "http://localhost:9229"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PROFILE = r"C:\Users\tbaltzakis\chrome-debug-profile"
TIMEOUT = 240
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


class Tab:
    def __init__(self, ws_url):
        import websocket

        self.ws = websocket.create_connection(ws_url, timeout=25, suppress_origin=True)
        self.mid = 0

    def cmd(self, method, params=None):
        self.mid += 1
        self.ws.send(json.dumps({"id": self.mid, "method": method, "params": params or {}}))
        dl = time.time() + 25
        while time.time() < dl:
            m = json.loads(self.ws.recv())
            if m.get("id") == self.mid:
                return m.get("result", {})
        return {}

    def js(self, expr):
        r = self.cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        return r.get("result", {}).get("value")

    def type_text(self, text):
        self.cmd("Input.insertText", {"text": text})

    def click_at(self, x, y):
        for t in ("mousePressed", "mouseReleased"):
            self.cmd(
                "Input.dispatchMouseEvent",
                {"type": t, "x": x, "y": y, "button": "left", "clickCount": 1},
            )

    def click_el(self, js_find):
        """Real-mouse click on the element returned by js_find (must return
        {x,y} of its center). Google ignores synthetic .click() on tiles."""
        pt = self.js(js_find)
        if not pt:
            return False
        self.click_at(pt["x"], pt["y"])
        return True

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass


def google_tab():
    for t in http_json(CDP + "/json/list"):
        if t.get("type") == "page" and "accounts.google.com" in t.get("url", ""):
            return Tab(t["webSocketDebuggerUrl"])
    return None


def open_tab(url):
    t = http_json(CDP + "/json/new?" + urllib.parse.quote(url, safe=""), method="PUT")
    return Tab(t["webSocketDebuggerUrl"])


SET_VAL = """(el,v)=>{const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));el.focus();return true}"""

CLICK_NEXT = """(()=>{const els=[...document.querySelectorAll('button,div[role=button],span')];
const b=els.find(e=>{const t=(e.innerText||'').trim();return ['Next','Continue','Συνέχεια','Επόμενο'].includes(t)&&e.offsetWidth});
if(b){b.click();return 'next'}return ''})()"""


def logged_in(tab):
    """True only when Google bounced us to a signed-in surface."""
    u = tab.js("location.href") or ""
    return u.startswith("https://myaccount.google.com") or u.startswith(
        "https://myaccount.google.com/"
    )


def wait_step(tab, timeout=30):
    end = time.time() + timeout
    last = ""
    while time.time() < end:
        state = tab.js("""(()=>{
 const em=document.querySelector('input[type=email]');
 const pw=document.querySelector('input[type=password]');
 const chooser=/accountchooser|signin\\/v2\\/identifier/.test(location.href)
   || !!document.querySelector('[data-identifier]');
 const body=(document.body.innerText||'').slice(0,4000);
 return JSON.stringify({email:!!em,pw:!!pw,chooser:chooser,url:location.href,
   challenge:/verify|2-Step|Authenticator|Approve|phone|τηλεόρ/i.test(body)});})()""")
        if state != last:
            print("state:", state[:200])
            last = state
        if logged_in(tab):
            return "logged_in"
        try:
            s = json.loads(state)
        except Exception:
            time.sleep(1)
            continue
        # password challenge pages also render a hidden email input —
        # check pw before email or we loop forever typing into a dead field
        if s.get("pw"):
            return "password"
        if s.get("email"):
            return "email"
        if s.get("chooser"):
            return "chooser"
        if s.get("challenge"):
            return "challenge"
        time.sleep(1)
    return "timeout"


def fill_field(tab, selector, value):
    """Click the field with a real mouse, then type — Google ignores JS-set values."""
    pt = tab.js(f"""(()=>{{const el=document.querySelector('{selector}');
if(!el)return null;const r=el.getBoundingClientRect();
return {{x:r.left+r.width/2,y:r.top+r.height/2}}}})()""")
    if not pt:
        return False
    tab.click_at(pt["x"], pt["y"])
    time.sleep(0.4)
    tab.type_text(value)
    return True


def click_next(tab):
    ok = tab.click_el("""(()=>{const els=[...document.querySelectorAll('button,div[role=button]')];
const b=els.find(e=>{const t=(e.innerText||'').trim();
return ['Next','Continue','Συνέχεια','Επόμενο'].includes(t)&&e.offsetWidth});
if(!b)return null;const r=b.getBoundingClientRect();
return {x:r.left+r.width/2,y:r.top+r.height/2}})()""")
    return "next" if ok else ""


def handle_2fa(tab):
    """Best-effort: TOTP if secret exists, else tell user to approve phone prompt."""
    totp_path = KEYS + "/google-totp-secret"
    if os.path.exists(totp_path):
        secret = open(totp_path).read().strip()
        try:
            import pyotp

            code = pyotp.TOTP(secret).now()
            # try to select "Authenticator app" challenge option first
            tab.js("""(()=>{const els=[...document.querySelectorAll('div[role=link],li,button,span')];
const b=els.find(e=>/authenticator|επαλήθευσης ταυτότητας/i.test(e.innerText||''));
if(b){b.click();return 'totp-opt'}return ''})()""")
            time.sleep(2)
            fill_field(tab, "input[type=tel],input[name=totpPin],input#totpPin", code)
            click_next(tab)
            time.sleep(4)
            if logged_in(tab):
                return True
        except Exception as e:
            print("totp err", e)
    # fallback: phone prompt / SMS — ask user to approve on the phone
    tg(
        "Google sign-in needs 2FA — approve the prompt on your phone "
        "(or SMS code) in the next 3 minutes."
    )
    end = time.time() + 180
    while time.time() < end:
        if logged_in(tab):
            return True
        time.sleep(3)
    return False


def main():
    ensure_browser()
    # open a fresh login tab
    tab = open_tab(
        "https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fmyaccount.google.com%2F"
    )
    time.sleep(6)
    pw = open(KEYS + "/google-password").read().strip()
    deadline = time.time() + TIMEOUT

    while time.time() < deadline:
        if logged_in(tab):
            # confirm it's stable — Google can transiently bounce through
            # myaccount before bouncing out to the logged-out about page
            time.sleep(4)
            if not logged_in(tab):
                continue
            tg("Google session restored in debug Chrome — watchers fully autonomous again.")
            # close tab via /json/close needs target id — find it
            for t in http_json(CDP + "/json/list"):
                if t.get("type") == "page" and "accounts.google.com" in t.get("url", ""):
                    try:
                        http_json(CDP + "/json/close/" + t["id"])
                    except Exception:
                        pass
            return
        st = wait_step(tab, timeout=8)
        if st == "email":
            if not fill_field(tab, "input[type=email]", EMAIL):
                print("email field fill failed")
            click_next(tab)
            time.sleep(3)
            continue
        if st == "chooser":
            # account tile — real mouse click (JS .click() doesn't navigate)
            r = tab.click_el("""(()=>{const els=[...document.querySelectorAll('[data-identifier]')];
const b=els.find(e=>/baltzakis\\.themis/i.test(e.getAttribute('data-identifier')||''));
if(!b)return null;const r=b.getBoundingClientRect();
return {x:r.left+r.width/2,y:r.top+r.height/2}})()""")
            print("chooser click:", "tile" if r else "no-tile")
            time.sleep(4)
            continue
        if st == "password":
            if not fill_field(tab, "input[type=password]", pw):
                print("password field fill failed")
            click_next(tab)
            time.sleep(4)
            continue
        if st == "challenge":
            if handle_2fa(tab):
                continue
            tg(
                "Google login could not clear 2FA automatically — "
                "please finish sign-in in the debug Chrome window."
            )
            raise SystemExit("2fa failed")
        if st == "timeout":
            # maybe still loading; loop once more then bail
            time.sleep(3)
            continue
        time.sleep(2)

    tg(
        "Google auto-login timed out — sign in manually in the debug Chrome "
        "(chrome-debug-profile, CDP :9229)."
    )
    raise SystemExit("timeout")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        print("err", e)
        tg("google-login error: " + str(e))
        raise
