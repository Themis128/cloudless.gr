#!/usr/bin/env python3
"""Slack-app health doctor — verify a deployed Slack app end-to-end.

Usage:
  python3 scripts/slack-app-doctor.py \
    --token "$SLACK_BOT_TOKEN" \
    --signing-secret "$SLACK_SIGNING_SECRET" \
    [--channel CXXXX] \
    [--commands-url https://your.app/api/<thing>-slack/commands] \
    [--user-id UXXXX]

Checks: auth.test, granted scopes, channel reachability, signed-request
round-trip. Exit 0 if all green, 1 if any red."""

import hashlib
import hmac
import json
import sys
import time
import urllib.error
import urllib.request
import urllib.parse

token = signing_secret = channel = commands_url = ""
user_id = "U0DOCTOR"

i = 1
while i < len(sys.argv):
    arg, val = sys.argv[i], (sys.argv[i + 1]
                             if i + 1 < len(sys.argv) else "")
    if arg == "--token":
        token = val
    elif arg == "--signing-secret":
        signing_secret = val
    elif arg == "--channel":
        channel = val
    elif arg == "--commands-url":
        commands_url = val
    elif arg == "--user-id":
        user_id = val
    elif arg in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)
    else:
        print(f"Unknown arg: {arg}", file=sys.stderr)
        sys.exit(2)
    i += 2

if not token or not signing_secret:
    print("✗ --token and --signing-secret are required (try --help)",
          file=sys.stderr)
    sys.exit(2)

FAIL = 0


def ok(m): print(f"  ✓ {m}")
def warn(m): print(f"  ⚠ {m}")


def fail(m):
    global FAIL
    FAIL = 1
    print(f"  ✗ {m}")


def slack_post(method: str, data: str = "") -> dict:
    req = urllib.request.Request(
        f"https://slack.com/api/{method}",
        data=data.encode() if data else b"",
        headers={"Authorization": f"Bearer {token}",
                 "Content-Type": "application/x-www-form-urlencoded"},
        method="POST")
    try:
        return json.loads(urllib.request.urlopen(req, timeout=15)
                          .read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"ok": False, "error": f"http_{e.code}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# 1. auth.test
print("=== 1. auth.test (token validity) ===")
resp = slack_post("auth.test")
if resp.get("ok"):
    ok(f"team={resp.get('team')}  bot_user={resp.get('user')}  "
       f"bot_id={resp.get('bot_id')}  user_id={resp.get('user_id')}")
else:
    fail(f"auth.test failed: {resp.get('error')}")
    print("    → fix: rotate token, check SSM, verify the app is "
          "installed")
    sys.exit(1)

# 2. Granted scopes
print("\n=== 2. Granted scopes ===")
req = urllib.request.Request(
    "https://slack.com/api/auth.test", data=b"", method="POST",
    headers={"Authorization": f"Bearer {token}",
             "Content-Type": "application/x-www-form-urlencoded"})
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        scopes = r.headers.get("X-OAuth-Scopes", "")
except Exception:
    scopes = ""
if scopes:
    ok(f"scopes: {scopes}")
else:
    warn("could not read X-OAuth-Scopes header (rare — Slack may "
         "strip it for app tokens)")

# 3. Channel reachability
if channel:
    print(f"\n=== 3. Channel reachability ({channel}) ===")
    resp = slack_post("conversations.info", f"channel={channel}")
    if resp.get("ok"):
        ch = resp.get("channel") or {}
        is_member = ch.get("is_member")
        ok(f"channel #{ch.get('name')} is_member={is_member}")
        if not is_member:
            warn("bot is NOT a member — chat.postMessage may fail "
                 "unless chat:write.public is granted")
    else:
        fail(f"conversations.info failed: {resp.get('error')}")
        print("    → fix: invite the bot to the channel with "
              "/invite @<bot>, or")
        print("           grant channels:join + conversations.join, "
              "then reinstall")

# 4. Signed-request round-trip
if commands_url:
    print(f"\n=== 4. Signed-request round-trip → {commands_url} ===")
    ts = str(int(time.time()))
    body = ("token=verify&team_id=T0DOCTOR&team_domain=test"
            "&channel_id=CTEST&channel_name=test"
            f"&user_id={user_id}&user_name=doctor"
            "&command=%2Fdoctor-help&text=&api_app_id=A0DOCTOR"
            "&is_enterprise_install=false"
            "&response_url=https%3A%2F%2Fhooks.slack.com%2Fcommands%2FT0%2F1%2Fabc"
            "&trigger_id=12345.67890.abcd")
    sig = "v0=" + hmac.new(signing_secret.encode(),
                           f"v0:{ts}:{body}".encode(),
                           hashlib.sha256).hexdigest()
    req = urllib.request.Request(
        commands_url, data=body.encode(), method="POST",
        headers={"Content-Type":
                 "application/x-www-form-urlencoded",
                 "x-slack-request-timestamp": ts,
                 "x-slack-signature": sig})
    try:
        r = urllib.request.urlopen(req, timeout=15)
        code, text = r.status, r.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        code, text = e.code, e.read().decode(errors="replace")
    except Exception as e:
        code, text = 0, str(e)

    if code == 200:
        ok(f"HTTP {code} — endpoint verified our signature and "
           "returned a response")
        print(f"    body preview: {text[:200].replace(chr(10), ' ')}")
    elif code == 401:
        fail("HTTP 401 — signing secret rejected by the endpoint")
        print("    → fix: the secret you passed does NOT match what "
              "the deployed app reads.")
        print("           Check SSM / env var / runtime cache (a "
              "cached old secret needs a restart).")
    else:
        fail(f"HTTP {code} — unexpected response")
        print(text[:500])

print()
if not FAIL:
    print("✓ doctor: all checks passed")
    sys.exit(0)
print("✗ doctor: one or more checks failed (see above)")
sys.exit(1)
