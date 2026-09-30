#!/usr/bin/env python3
"""Bootstrap the DEDICATED Newsletter Slack app secrets into Cloudflare
(Wrangler + D1) + GH.

Run AFTER installing the app at https://api.slack.com/apps from
slack-newsletter-app.manifest.json. Copy the bot token + signing secret
from the app's settings pages, then run:

  python3 scripts/setup-newsletter-slack-app.py \\
    --bot-token       "xoxb-..." \\
    --signing-secret  "32-char-hex" \\
    --channel         "C0BBDKY6Q9E"    # the #newsletter channel ID

Idempotent — re-running after a token rotation overwrites cleanly.
See companion: scripts/slack-app-doctor.py (health probe)."""

import hashlib
import hmac
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from cf_secrets import (cf_config_set, cf_secret_set,  # noqa: E402
                        cf_verify_auth)

bot_token = signing_secret = channel = ""
endpoint = "https://cloudless.gr/api/newsletter-slack/commands"

i = 1
while i < len(sys.argv):
    arg = sys.argv[i]
    if arg in ("--bot-token", "--signing-secret", "--channel", "--endpoint"):
        if i + 1 >= len(sys.argv):
            print(f"Missing value for {arg}", file=sys.stderr)
            sys.exit(2)
        val = sys.argv[i + 1]
        if arg == "--bot-token":
            bot_token = val
        elif arg == "--signing-secret":
            signing_secret = val
        elif arg == "--channel":
            channel = val
        else:
            endpoint = val
        i += 2
    elif arg in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)
    else:
        print(f"Unknown arg: {arg}", file=sys.stderr)
        sys.exit(2)

if not (bot_token and signing_secret and channel):
    print("✗ --bot-token, --signing-secret, and --channel are all "
          "required", file=sys.stderr)
    print("  Try --help for the full usage.")
    sys.exit(2)


def post(url: str, body, headers: dict) -> tuple[int, str]:
    data = body if isinstance(body, (bytes, str)) else json.dumps(body)
    if isinstance(data, str):
        data = data.encode()
    req = urllib.request.Request(url, data=data, headers=headers,
                                 method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")
    except Exception as e:
        return 0, str(e)


# 1. auth.test
print("=== 1. auth.test (verify bot token before we store it) ===")
code, text = post("https://slack.com/api/auth.test", b"",
                  {"Authorization": f"Bearer {bot_token}",
                   "Content-Type": "application/x-www-form-urlencoded"})
try:
    resp = json.loads(text)
except Exception:
    resp = {}
if not resp.get("ok"):
    print(f"  ✗ auth.test failed: {resp.get('error', text[:200])} — "
          "refusing to store an invalid token", file=sys.stderr)
    sys.exit(1)
print(f"  ✓ team={resp.get('team')}  bot_user={resp.get('user')}")

# 2. Store secrets
print("\n=== 2. Storing secrets in Cloudflare ===")
if cf_verify_auth():
    sys.exit(1)
for name, value in (("NEWSLETTER_SLACK_BOT_TOKEN", bot_token),
                    ("NEWSLETTER_SLACK_SIGNING_SECRET", signing_secret),
                    ("NEWSLETTER_SLACK_CHANNEL_ID", channel)):
    print(f"  {name}: ", end="", flush=True)
    print("Wrangler ok " if cf_secret_set(name, value) == 0
          else "Wrangler failed ", end="")
    print("D1 ok" if cf_config_set(name, value) else "D1 failed")

# 3. Signed-request smoke test
print(f"\n=== 3. Signed-request smoke test → {endpoint} ===")
ts = str(int(time.time()))
body = ("token=verify&team_id=T0BOOT&team_domain=test"
        f"&channel_id={channel}&channel_name=newsletter"
        "&user_id=U0BOOT&user_name=bootstrap&command=%2Fnewsletter-help"
        "&text=&api_app_id=A0BOOT&is_enterprise_install=false"
        "&response_url=https%3A%2F%2Fhooks.slack.com%2Fcommands%2FT0%2F1%2Fabc"
        "&trigger_id=12345.67890.abcd")
sig = "v0=" + hmac.new(signing_secret.encode(),
                       f"v0:{ts}:{body}".encode(),
                       hashlib.sha256).hexdigest()
code, text = post(endpoint, body, {
    "Content-Type": "application/x-www-form-urlencoded",
    "x-slack-request-timestamp": ts,
    "x-slack-signature": sig})
if code == 200:
    print("  ✓ HTTP 200 — endpoint verified signature using the "
          "Cloudflare-stored secret")
elif code == 401:
    print("  ⚠ HTTP 401 — endpoint rejected signature.")
    print("    Reason: the Worker may be reading a cached old secret. "
          "Wait ~5 min")
    print("    for the cache to expire OR redeploy the app to force "
          "a re-read.")
else:
    print(f"  ⚠ HTTP {code} — unexpected")
    print(text[:400])

# 4. Hello message
print(f"\n=== 4. chat.postMessage to {channel} (hello) ===")
hello = {
    "channel": channel,
    "text": (":newspaper: Newsletter app installed — try "
             "`/newsletter-help` or open the App Home (:house: tab)."),
    "blocks": [
        {"type": "header", "text": {"type": "plain_text",
                                    "text": ":newspaper: Newsletter app "
                                            "installed", "emoji": True}},
        {"type": "section", "text": {
            "type": "mrkdwn",
            "text": ("This is the dedicated Newsletter Slack app — "
                     "separate from the main Cloudless app, with its own "
                     "signing secret and bot token.\\n\\nTry:\\n"
                     "• `/newsletter-help` — list all commands\\n"
                     "• `/newsletter-list` — pending drafts + gate "
                     "verdicts\\n"
                     "• `/newsletter-stats` — subscribers + drafts + "
                     "cadence\\n"
                     "• Open the :house: Home tab — live 3-layer "
                     "dashboard")}},
    ],
}
code, text = post("https://slack.com/api/chat.postMessage", hello,
                  {"Authorization": f"Bearer {bot_token}",
                   "Content-Type": "application/json; charset=utf-8"})
try:
    ok = json.loads(text).get("ok")
    err = json.loads(text).get("error", "")
except Exception:
    ok, err = False, text[:200]
if ok:
    print(f"  ✓ hello posted to {channel}")
else:
    print(f"  ⚠ chat.postMessage failed: {err}")
    print("    Common fixes:")
    print("    • Invite the bot to the channel via '/invite @<bot>'")
    print("    • Add chat:write.public scope + reinstall")

print(f"""
✓ bootstrap complete. Next steps:
  • Open Slack → Apps → Newsletter → Home tab — should show the 3-layer dashboard
  • Re-run the doctor anytime:
      python3 scripts/slack-app-doctor.py \\
        --token "<bot-token>" \\
        --signing-secret "<signing-secret>" \\
        --channel "{channel}" \\
        --commands-url {endpoint}""")
