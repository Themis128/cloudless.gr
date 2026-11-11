"""One-shot OAuth flow: grants gmail.readonly for the account you pick in the
browser, saves refresh_token to secrets/gmail-token.json.
Run: python gmail_auth.py   (a browser tab opens; approve it)"""

import json
import time
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

KEYS = "C:/Users/tbaltzakis/AppData/Roaming/devin/secrets"
CLIENTS = json.load(open(r"C:\Users\tbaltzakis\.config\google-calendar-mcp\gcp-oauth.keys.json"))
CI = CLIENTS.get("installed") or CLIENTS.get("web")
REDIRECT = "http://localhost:50000/auth/callback"
SCOPE = "https://www.googleapis.com/auth/gmail.readonly"

code = {}


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        q = urllib.parse.urlparse(self.path).query
        p = urllib.parse.parse_qs(q)
        if "code" in p:
            code["code"] = p["code"][0]
            self.send_response(200)
            self.wfile.write(b"<h2>OK - you can close this tab</h2>")
        else:
            self.send_response(400)
            self.wfile.write(b"missing code")
        self.end_headers()

    def log_message(self, *a):
        pass


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
print("opening browser for consent...")
webbrowser.open(url)

srv = HTTPServer(("127.0.0.1", 50000), H)
srv.timeout = 43200  # give up after 12h if never consented (auto-launch case)
srv.handle_request()  # single request
srv.server_close()

if "code" not in code:
    raise SystemExit("no auth code received")

data = urllib.parse.urlencode(
    {
        "code": code["code"],
        "client_id": CI["client_id"],
        "client_secret": CI["client_secret"],
        "redirect_uri": REDIRECT,
        "grant_type": "authorization_code",
    }
).encode()
try:
    n = json.loads(urllib.request.urlopen(CI["token_uri"], data=data).read())
except urllib.error.HTTPError as e:
    raise SystemExit("token exchange failed: " + e.read().decode()[:500]) from None
if "refresh_token" not in n:
    raise SystemExit("no refresh_token in response: " + json.dumps(n))
n["expires_at"] = time.time() + n["expires_in"] - 60
if "refresh_token_expires_in" in n:
    n["refresh_expires_at"] = time.time() + n["refresh_token_expires_in"] - 3600
json.dump(n, open(KEYS + "/gmail-token.json", "w"))
prof = urllib.request.urlopen(
    urllib.request.Request(
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        headers={"Authorization": "Bearer " + n["access_token"]},
    )
)
print("authed:", prof.read().decode())
