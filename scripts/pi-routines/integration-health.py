#!/usr/bin/env python3
"""Weekly API integration health check for cloudless.gr — posts to Slack."""

import datetime
import json
import subprocess
import urllib.error
import urllib.request


def ssm(key):
    r = subprocess.run(
        [
            "aws",
            "ssm",
            "get-parameter",
            "--name",
            f"/cloudless/production/{key}",
            "--with-decryption",
            "--query",
            "Parameter.Value",
            "--output",
            "text",
            "--region",
            "us-east-1",
        ],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        raise RuntimeError(f"SSM lookup failed for {key!r}: {r.stderr.strip()}")
    value = r.stdout.strip()
    if not value:
        raise RuntimeError(f"SSM returned empty value for {key!r}")
    return value


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


def api_check(url, headers=None):
    try:
        req = urllib.request.Request(url, headers=headers or {})
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, {}
    except Exception as e:
        return 0, {"_err": str(e)}


token = ssm("SLACK_BOT_TOKEN")
channel = ssm("SLACK_DEFAULT_CHANNEL")
today = datetime.date.today().isoformat()
R = []

# Stripe
sk = ssm("STRIPE_SECRET_KEY")
code, _ = api_check("https://api.stripe.com/v1/balance", {"Authorization": f"Bearer {sk}"})
R.append((":green_circle:" if code == 200 else ":red_circle:", "Stripe", f"HTTP {code}"))

# EspoCRM
hk = ssm("HUBSPOT_API_KEY")
code, _ = api_check(
    "https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {"Authorization": f"Bearer {hk}"}
)
R.append((":green_circle:" if code == 200 else ":red_circle:", "EspoCRM CRM", f"HTTP {code}"))

# Slack bot
code, data = api_check("https://slack.com/api/auth.test", {"Authorization": f"Bearer {token}"})
ok = data.get("ok")
R.append((":green_circle:" if ok else ":red_circle:", "Slack Bot", "OK" if ok else "FAIL"))

# Notion
nk = ssm("NOTION_API_KEY")
code, _ = api_check(
    "https://api.notion.com/v1/users/me",
    {"Authorization": f"Bearer {nk}", "Notion-Version": "2022-06-28"},
)
R.append((":green_circle:" if code == 200 else ":red_circle:", "Notion", f"HTTP {code}"))

# Sentry
st = ssm("SENTRY_AUTH_TOKEN")
so = ssm("SENTRY_ORG")
code, _ = api_check(
    f"https://sentry.io/api/0/organizations/{so}/", {"Authorization": f"Bearer {st}"}
)
R.append((":green_circle:" if code == 200 else ":red_circle:", "Sentry", f"HTTP {code}"))

# ActiveCampaign
ac_url = ssm("ACTIVECAMPAIGN_API_URL")
ac_tok = ssm("ACTIVECAMPAIGN_API_TOKEN") if ssm("ACTIVECAMPAIGN_API_TOKEN") else ""
if ac_url and ac_tok:
    code, _ = api_check(f"{ac_url}/api/3/contacts?limit=1", {"Api-Token": ac_tok})
    R.append(
        (":green_circle:" if code == 200 else ":red_circle:", "ActiveCampaign", f"HTTP {code}")
    )
else:
    R.append((":grey_question:", "ActiveCampaign", "SSM key not found"))

# Known-degraded (persistent, not actionable)
R.append(
    (":yellow_circle:", "Meta / Instagram", "Blocked — ad policy violation (known, appeal pending)")
)
R.append((":yellow_circle:", "X (Twitter) Ads", "Awaiting API approval (known)"))

# App health endpoint
code, _ = api_check("https://cloudless.gr/api/health")
R.append(
    (
        ":green_circle:" if code == 200 else ":red_circle:",
        "cloudless.gr /api/health",
        f"HTTP {code}",
    )
)

lines = [f"*Integration Health Check — {today}*"]
lines += [f"{em} *{name}* — {status}" for em, name, status in R]
lines.append("_Next check: next Monday_")
msg = "\n".join(lines)
slack_post(token, channel, msg)
print(msg)
