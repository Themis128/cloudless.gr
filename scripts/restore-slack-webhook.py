#!/usr/bin/env python3
"""One-shot restore of the Cloudless Slack incoming webhook.

CONTEXT: On 2026-05-25 Slack auto-invalidated this app's webhook
URL because they detected it had been committed to a public GitHub
repo. Since then cron Slack pings were silently dropped.

HOW TO GET A NEW WEBHOOK URL (browser, ~30 seconds):
  1. Open: https://api.slack.com/apps/A0ARP8UGQLB/install-on-team
  2. Slack shows a consent screen with the scopes from
     slack-app.manifest.json. Click Allow.
  3. The next page asks "Post to as a channel". Select #newsletter
     (or any channel you want the cron pings to land in).
  4. Slack shows the new "Webhook URL"
     (https://hooks.slack.com/services/T09AF5VTK4G/...). Copy it.
  5. Run this script and paste at the prompt."""

import getpass
import json
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from cf_secrets import (cf_config_set, cf_secret_set,  # noqa: E402
                        cf_verify_auth)

if not shutil.which("gh"):
    print("ERROR: gh CLI not found.", file=sys.stderr)
    sys.exit(1)
if subprocess.run(["gh", "auth", "status"], capture_output=True).returncode:
    print("ERROR: gh CLI not authenticated. Run 'gh auth login' first.",
          file=sys.stderr)
    sys.exit(1)

if not sys.stdin.isatty():
    print("ERROR: stdin is not a tty — this script expects interactive "
          "paste.", file=sys.stderr)
    sys.exit(1)
url = getpass.getpass("Paste the new Webhook URL "
                      "(https://hooks.slack.com/services/...): ").strip()

if url.startswith("https://hooks.slack.com/services/T09AF5VTK4G/"):
    pass
elif url.startswith("https://hooks.slack.com/services/"):
    print("WARN: webhook is on a different workspace (expected "
          "T09AF5VTK4G prefix). Continuing anyway.", file=sys.stderr)
else:
    print("ERROR: doesn't look like a Slack webhook URL.",
          file=sys.stderr)
    sys.exit(1)

# Test it BEFORE storing
print("Posting test message to verify webhook is live ... ", end="",
      flush=True)
req = urllib.request.Request(
    url,
    data=json.dumps({
        "text": ":hammer_and_wrench: cloudless newsletter pipeline — "
                "webhook restore probe (delete me if you like)"}).encode(),
    headers={"Content-Type": "application/json"}, method="POST")
try:
    body = urllib.request.urlopen(req, timeout=15).read().decode()
    ok = "ok" in body
except urllib.error.HTTPError as e:
    print(f"FAILED (HTTP {e.code}, body={e.read().decode()[:200]})")
    sys.exit(1)
except Exception as e:
    print(f"FAILED ({e})")
    sys.exit(1)
if not ok:
    print(f"FAILED (body={body[:200]})")
    sys.exit(1)
print("ok (Slack accepted the post)")

if cf_verify_auth():
    sys.exit(1)

print("Writing SLACK_WEBHOOK_URL to D1... ", end="", flush=True)
print("D1 ok" if cf_config_set("SLACK_WEBHOOK_URL", url) else "D1 failed")

print("Writing SLACK_WEBHOOK_URL to Wrangler... ", end="", flush=True)
print("Wrangler ok" if cf_secret_set("SLACK_WEBHOOK_URL", url) == 0
      else "Wrangler failed")

print("Setting GH Actions repo secret SLACK_WEBHOOK_URL ... ",
      end="", flush=True)
r = subprocess.run(["gh", "secret", "set", "SLACK_WEBHOOK_URL",
                    "--body", url], capture_output=True)
print("ok" if r.returncode == 0 else "FAILED")

print("""
Done. Next weekly-article-draft.yml + weekly-newsletter.yml runs
will post into the channel you bound the webhook to.""")
