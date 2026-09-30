#!/usr/bin/env python3
"""E2E test of the live /cloudless-newsletter Slack surface —
reads SLACK_SIGNING_SECRET from SSM, signs a `list` request,
posts to prod, prints the reply."""

import hashlib
import hmac
import subprocess
import sys
import time
import urllib.error
import urllib.request

r = subprocess.run(
    [
        "aws",
        "ssm",
        "get-parameter",
        "--region",
        "us-east-1",
        "--name",
        "/cloudless/production/SLACK_SIGNING_SECRET",
        "--with-decryption",
        "--query",
        "Parameter.Value",
        "--output",
        "text",
    ],
    capture_output=True,
    text=True,
)
SS = r.stdout.strip()
if not SS:
    sys.exit("✗ Could not read SLACK_SIGNING_SECRET from SSM")
print(f"secret length: {len(SS)}")

ts = str(int(time.time()))
body = (
    "token=verification-token&team_id=T123&"
    "team_domain=cloudless&channel_id=C0BBDKY6Q9E&"
    "channel_name=newsletter&user_id=U09AF5VU7LY&"
    "user_name=themis&command=%2Fcloudless-newsletter&"
    "text=list&api_app_id=A09AAAAAAAA&"
    "is_enterprise_install=false&"
    "response_url=https%3A%2F%2Fhooks.slack.com%2F"
    "commands%2FT123%2F12345%2Fabc&"
    "trigger_id=12345.67890.abcd"
)

sig = "v0=" + hmac.new(SS.encode(), f"v0:{ts}:{body}".encode(), hashlib.sha256).hexdigest()
print(f"ts={ts}  sig={sig[:18]}…")

req = urllib.request.Request(
    "https://cloudless.gr/api/slack/commands",
    data=body.encode(),
    method="POST",
    headers={
        "Content-Type": "application/x-www-form-urlencoded",
        "x-slack-request-timestamp": ts,
        "x-slack-signature": sig,
    },
)
try:
    resp = urllib.request.urlopen(req, timeout=30)
    code, raw = resp.status, resp.read()
except urllib.error.HTTPError as e:
    code, raw = e.code, e.read()
except Exception as e:
    code, raw = 0, str(e).encode()

print(f"HTTP: {code}")
print("--- response body ---")
print(raw[:3000].decode(errors="replace"))
