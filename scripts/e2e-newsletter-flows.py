#!/usr/bin/env python3
"""Hit every /cloudless-newsletter subcommand variant against prod
with a real Slack-signed request. The bogus-slug cases confirm
the not-found path without publishing."""

import hashlib
import hmac
import json
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

BODY_TMPL = (
    "token=verification-token&team_id=T123&"
    "team_domain=cloudless&channel_id=C0BBDKY6Q9E&"
    "channel_name=newsletter&user_id=U09AF5VU7LY&"
    "user_name=themis&command=%2Fcloudless-newsletter&"
    "text={text}&api_app_id=A09AAAAAAAA&"
    "is_enterprise_install=false&"
    "response_url=https%3A%2F%2Fhooks.slack.com%2F"
    "commands%2FT123%2F12345%2Fabc&"
    "trigger_id=12345.67890.abcd")

r = subprocess.run(
    ["aws", "ssm", "get-parameter", "--region", "us-east-1",
     "--name", "/cloudless/production/SLACK_SIGNING_SECRET",
     "--with-decryption", "--query", "Parameter.Value",
     "--output", "text"], capture_output=True, text=True)
SS = r.stdout.strip()


def post(label: str, text: str) -> None:
    ts = str(int(time.time()))
    body = BODY_TMPL.format(text=text)
    sig = "v0=" + hmac.new(SS.encode(),
                           f"v0:{ts}:{body}".encode(),
                           hashlib.sha256).hexdigest()
    req = urllib.request.Request(
        "https://cloudless.gr/api/slack/commands",
        data=body.encode(), method="POST",
        headers={
            "Content-Type":
                "application/x-www-form-urlencoded",
            "x-slack-request-timestamp": ts,
            "x-slack-signature": sig})
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        code, raw = resp.status, resp.read()
    except urllib.error.HTTPError as e:
        code, raw = e.code, e.read()
    except Exception as e:
        code, raw = 0, str(e).encode()

    print(f"\n=== {label} → HTTP {code} ===")
    try:
        d = json.loads(raw)
        texts = [b.get("text", {}).get("text", "")
                 for b in d.get("blocks", [])
                 if isinstance(b.get("text"), dict)]
        print("\n".join(texts[:6]) if texts
              else d.get("text", json.dumps(d)[:400]))
    except Exception:
        print(raw[:500].decode(errors="replace"))


post("list", "list")
post("no-args (help)", "")
post("send no-slug", "send")
post("send bogus-slug", "send%20does-not-exist-12345")
post("unpublish no-slug", "unpublish")
post("unpublish bogus-slug",
     "unpublish%20does-not-exist-12345")

print("\n✓ e2e flow probe complete")
