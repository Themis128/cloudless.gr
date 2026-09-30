#!/usr/bin/env python3
"""One-time bootstrap for the Slack app-config token pair.

Slack app-configuration tokens expire every 12 hours, but they come
with a long-lived refresh token. After this seed runs once, the
rotate-slack-app-config-token.py script (called from
slack-manifest-apply.yml) keeps the access token fresh automatically.

HOW TO MINT THE TOKEN PAIR (browser, ~30s):
  1. https://api.slack.com/apps -> Your Apps page (NOT inside a specific app)
  2. Click "Refresh Tokens" or "Generate Tokens" in the top-right.
  3. Select workspace "cloudless.gr" (or your dev workspace).
  4. Copy the two values that appear:
       - "Access Token"   (xoxe.xoxp-...)  — short-lived, ~12h
       - "Refresh Token"  (xoxe-...)       — long-lived
  5. Run this script. It will prompt for both (input hidden).

Both values are written as:
  - Wrangler secrets: SLACK_APP_CONFIG_TOKEN, SLACK_APP_CONFIG_REFRESH_TOKEN
  - D1 app_config:    slack_app_config_token, slack_app_config_refresh_token"""

import getpass
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from cf_secrets import cf_config_set, cf_secret_set, cf_verify_auth  # noqa: E402

if cf_verify_auth():
    sys.exit(1)

if not sys.stdin.isatty():
    print("ERROR: stdin is not a tty — this script expects interactive paste.", file=sys.stderr)
    sys.exit(1)

access = getpass.getpass("Paste Slack ACCESS token (xoxe.xoxp-...): ")
refresh = getpass.getpass("Paste Slack REFRESH token (xoxe-...): ")

if not access or not refresh:
    print("ERROR: both tokens are required.", file=sys.stderr)
    sys.exit(1)
if not access.startswith("xoxe.xoxp-"):
    print("WARN: access token prefix is not xoxe.xoxp- — continuing anyway.", file=sys.stderr)
if not refresh.startswith("xoxe-"):
    print("WARN: refresh token prefix is not xoxe- — continuing anyway.", file=sys.stderr)

print("Verifying access token against Slack auth.test ... ", end="", flush=True)
req = urllib.request.Request(
    "https://slack.com/api/auth.test",
    data=b"",
    headers={"Authorization": f"Bearer {access}"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        probe = json.loads(r.read())
except Exception as e:
    print(f"FAILED ({e})")
    sys.exit(1)
if not probe.get("ok"):
    print(f"FAILED (Slack: {probe.get('error', '?')})")
    sys.exit(1)
print(f"ok (team: {probe.get('team', '')})")

for name, value in (
    ("SLACK_APP_CONFIG_REFRESH_TOKEN", refresh),
    ("SLACK_APP_CONFIG_TOKEN", access),
):
    print(f"Writing {name}... ", end="", flush=True)
    print("Wrangler ok " if cf_secret_set(name, value) == 0 else "Wrangler failed ", end="")
    print("D1 ok" if cf_config_set(name, value) else "D1 failed")

print("""
Done. Next run of slack-manifest-apply.yml will auto-rotate the access
token via tooling.tokens.rotate — no further manual steps needed.""")
