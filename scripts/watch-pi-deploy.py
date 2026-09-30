#!/usr/bin/env python3
"""Watch the latest deploy-pi.yml run + once rolled-out, hit
/api/newsletter-slack/events with a signed app_home_opened payload to
confirm the verifier reads the configured secret.

Signing secret comes from env SLACK_SIGNING_SECRET, else the
newsletter-app D1 config (NEWSLETTER_SLACK_SIGNING_SECRET)."""

import hashlib
import hmac
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
import os

from cf_secrets import cf_config_get  # noqa: E402

r = subprocess.run(
    [
        "gh",
        "run",
        "list",
        "--repo",
        "Themis128/cloudless.gr",
        "--workflow=deploy-pi.yml",
        "--limit",
        "1",
        "--json",
        "databaseId",
        "--jq",
        ".[0].databaseId",
    ],
    capture_output=True,
    text=True,
)
run_id = r.stdout.strip()
print(f"Watching run {run_id}")
subprocess.run(
    [
        "gh",
        "run",
        "view",
        run_id,
        "--repo",
        "Themis128/cloudless.gr",
        "--json",
        "jobs",
        "--jq",
        ".jobs[] | {name, status, conclusion}",
    ]
)

signing_secret = os.environ.get("SLACK_SIGNING_SECRET") or cf_config_get(
    "NEWSLETTER_SLACK_SIGNING_SECRET"
)
if not signing_secret or signing_secret == "null":
    sys.exit(
        "no signing secret (set SLACK_SIGNING_SECRET or seed NEWSLETTER_SLACK_SIGNING_SECRET in D1)"
    )

print("\n=== Probing endpoint with signed app_home_opened payload ===")
ts = str(int(time.time()))
body = json.dumps(
    {
        "type": "event_callback",
        "team_id": "T09AF5VTK4G",
        "api_app_id": "A0BAQUDSXBN",
        "event": {
            "type": "app_home_opened",
            "user": "U09AF5VU7LY",
            "channel": "D00PROBE",
            "event_ts": f"{ts}.000000",
            "tab": "home",
        },
        "event_id": f"Ev{ts}",
        "event_time": int(ts),
    }
)
sig = (
    "v0="
    + hmac.new(signing_secret.encode(), f"v0:{ts}:{body}".encode(), hashlib.sha256).hexdigest()
)
req = urllib.request.Request(
    "https://cloudless.gr/api/newsletter-slack/events",
    data=body.encode(),
    method="POST",
    headers={
        "Content-Type": "application/json",
        "x-slack-request-timestamp": ts,
        "x-slack-signature": sig,
    },
)
try:
    resp = urllib.request.urlopen(req, timeout=15)
    print(f"HTTP {resp.status}")
    print(resp.read()[:300].decode(errors="replace"))
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}")
    print(e.read()[:300].decode(errors="replace"))
