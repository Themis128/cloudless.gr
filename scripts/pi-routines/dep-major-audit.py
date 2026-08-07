#!/usr/bin/env python3
"""Monthly major dependency version audit for cloudless.gr — posts to Slack.

Reads secrets from Cloudflare D1 config via /api/config endpoint
(falls back to environment variables).
"""

import datetime
import json
import re
import subprocess
import urllib.parse
import urllib.request
import os
import sys


CONFIG_URL = os.environ.get("CONFIG_URL", "http://localhost:8787/api/config")


def config_get(key):
    """Get a value from D1 app_config via /api/config endpoint."""
    config_key = key.lower()
    try:
        req = urllib.request.Request(
            f"{CONFIG_URL}?key={urllib.parse.quote(config_key)}",
            headers={"Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
        if data.get("value"):
            return data["value"]
    except Exception:
        pass
    # Fallback to environment variable
    env_key = key.upper().replace("-", "_")
    return os.environ.get(env_key)


def slack_post(token, channel, text):
    body = json.dumps({"channel": channel, "text": text}).encode()
    req = urllib.request.Request(
        "https://slack.com/api/chat.postMessage",
        data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        resp = json.loads(r.read())
    if not resp.get("ok"):
        raise RuntimeError(f"Slack API error: {resp.get('error', 'unknown')}")


# Get secrets from Cloudflare/D1
token = config_get("slack_bot_token")
channel = config_get("slack_default_channel")
gh_token = config_get("github_token")

if not token:
    print("ERROR: SLACK_BOT_TOKEN not found in Cloudflare/D1 config", file=sys.stderr)
    sys.exit(1)
if not channel:
    print("ERROR: SLACK_DEFAULT_CHANNEL not found in Cloudflare/D1 config", file=sys.stderr)
    sys.exit(1)
if not gh_token:
    print("ERROR: GITHUB_TOKEN not found in Cloudflare/D1 config", file=sys.stderr)
    sys.exit(1)

today = datetime.date.today().isoformat()

# Fetch package.json from main branch
req = urllib.request.Request(
    "https://raw.githubusercontent.com/Themis128/cloudless.gr/main/package.json",
    headers={"Authorization": f"token {gh_token}"},
)
with urllib.request.urlopen(req) as r:
    pkg = json.loads(r.read())

all_deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
KEY_PKGS = [
    "next",
    "react",
    "react-dom",
    "@sentry/nextjs",
    "stripe",
    "aws-amplify",
    "resend",  # Replaced @aws-sdk/client-ses
    "next-intl",
    "@playwright/test",
    "tailwindcss",
]

rows = []
upgrades = 0
for name in KEY_PKGS:
    if name not in all_deps:
        continue
    installed = re.sub(r"^[\^~>=<]+", "", all_deps[name])
    try:
        enc = urllib.parse.quote(name, safe="@%")
        with urllib.request.urlopen(f"https://registry.npmjs.org/{enc}/latest", timeout=10) as r:
            latest = json.loads(r.read())["version"]
    except Exception:
        rows.append(f":grey_question: `{name}` | {installed} | unknown")
        continue
    inst_maj = int(installed.split(".")[0]) if installed[:1].isdigit() else 0
    lat_maj = int(latest.split(".")[0])
    if lat_maj > inst_maj:
        rows.append(f":warning: `{name}` | {installed} | {latest} | *major upgrade available*")
        upgrades += 1
    else:
        rows.append(f":white_check_mark: `{name}` | {installed} | {latest}")

header = f"*Monthly Dep Major Audit — {today}*\n_Package | Installed | Latest | Status_"
body = header + "\n" + "\n".join(rows)
if upgrades:
    body += f"\n\n:warning: {upgrades} major upgrade(s) available. Review breaking changes before upgrading."
else:
    body += "\n\n:white_check_mark: All key packages on latest major version."
slack_post(token, channel, body)
print(body)