"""One-shot OAuth callback listener for gmail-send consent.
Listens on 127.0.0.1:50000/auth/callback, writes ?code= to
%APPDATA%/devin/secrets/gmail-send-code.txt then exits.
Run: python oauth-callback-once.py
"""

import os
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

OUT = os.path.join(os.environ["APPDATA"], "devin", "secrets", "gmail-send-code.txt")


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        p = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if "code" in p:
            with open(OUT, "w") as f:
                f.write(p["code"][0])
            self.send_response(200)
            self.wfile.write(b"<h2>OK - you can close this tab</h2>")
        else:
            self.send_response(400)
            self.wfile.write(b"missing code")
        self.end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 50000), H).serve_forever()
