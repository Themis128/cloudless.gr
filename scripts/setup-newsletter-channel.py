#!/usr/bin/env python3
"""One-shot bootstrap for the dedicated #newsletter Slack channel.

Idempotent: safe to re-run. Uses a Slack USER token (workspace admin
scopes, including channels:manage):
  1. Creates #newsletter (or reuses if it already exists)
  2. Invites the @cloudless_bot to it
  3. Sets a topic + purpose
  4. Posts a welcome card
  5. Writes the channel ID to D1 app_config as newsletter_slack_channel_id
  6. Writes it as a GitHub Actions repository secret

After this runs, the user token is discarded — the bot's chat:write scope
is enough to post into a channel it's a member of.

HOW TO MINT A USER TOKEN (browser, ~60s):
  https://api.slack.com/apps -> Cloudless app -> OAuth & Permissions ->
  User Token Scopes: channels:manage, channels:read,
  channels:write.invites -> Reinstall to Workspace -> copy xoxp- token."""

import getpass
import json
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from cf_secrets import cf_config_get, cf_config_set, cf_secret_set, cf_verify_auth  # noqa: E402

CHANNEL_NAME = "newsletter"
SLACK = "https://slack.com/api"

if not shutil.which("gh"):
    print("ERROR: gh CLI not found — needed to write the GH Actions secret.", file=sys.stderr)
    sys.exit(1)
if subprocess.run(["gh", "auth", "status"], capture_output=True).returncode:
    print("ERROR: gh CLI not authenticated. Run 'gh auth login' first.", file=sys.stderr)
    sys.exit(1)

if not sys.stdin.isatty():
    print("ERROR: stdin is not a tty — this script expects interactive paste.", file=sys.stderr)
    sys.exit(1)
user_token = getpass.getpass("Paste Slack USER OAuth token (xoxp-...): ")
if not user_token.startswith("xoxp-"):
    print(
        "ERROR: token prefix is not xoxp- — that's a user token. Got something else.",
        file=sys.stderr,
    )
    sys.exit(1)


def slack(method: str, token: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"{SLACK}/{method}",
        data=json.dumps(body).encode() if body is not None else b"",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=utf-8",
        },
    )
    try:
        return json.loads(urllib.request.urlopen(req, timeout=30).read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"ok": False, "error": f"http_{e.code}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


print("Verifying user token ... ", end="", flush=True)
whoami = slack("auth.test", user_token)
if not whoami.get("ok"):
    print(f"FAILED ({whoami.get('error')})")
    sys.exit(1)
print(f"ok (team={whoami.get('team')}, user={whoami.get('user')})")

bot_token = cf_config_get("SLACK_BOT_TOKEN")
if not bot_token or bot_token == "null":
    print(
        "ERROR: SLACK_BOT_TOKEN not found in Cloudflare/D1. Run "
        "activate-integration.py set SLACK_BOT_TOKEN <token> first."
    )
    sys.exit(1)
bot_info = slack("auth.test", bot_token)
bot_user_id = bot_info.get("user_id", "")
bot_name = bot_info.get("user", "")
print(f"Bot identity: @{bot_name} ({bot_user_id})")

print(f"\n=== Locating #{CHANNEL_NAME} ===")
channels = slack(
    "conversations.list?exclude_archived=true&limit=1000&types=public_channel", user_token
)
if not channels.get("ok"):
    print(f"list failed: {channels}")
    sys.exit(1)
ch_id = next((c["id"] for c in channels.get("channels", []) if c.get("name") == CHANNEL_NAME), "")

if ch_id:
    print(f"Channel already exists: {ch_id}")
else:
    print(f"Creating #{CHANNEL_NAME} ...")
    created = slack("conversations.create", user_token, {"name": CHANNEL_NAME, "is_private": False})
    ch_id = (created.get("channel") or {}).get("id", "")
    if not ch_id:
        print(f"Create failed: {created}")
        sys.exit(1)
    print(f"Created: {ch_id}")

print(f"\n=== Inviting @{bot_name} ===")
invite = slack("conversations.invite", user_token, {"channel": ch_id, "users": bot_user_id})
if invite.get("ok") or invite.get("error") == "already_in_channel":
    print(f"ok ({invite.get('error', 'invited')})")
else:
    print(f"invite failed: {invite}")
    sys.exit(1)

print("\n=== Setting topic + purpose ===")
r = slack(
    "conversations.setTopic",
    user_token,
    {"channel": ch_id, "topic": "Newsletter ops — drafts, publishes, subscriber events"},
)
print(f"topic: ok={r.get('ok')}, error={r.get('error', 'none')}")
r = slack(
    "conversations.setPurpose",
    user_token,
    {
        "channel": ch_id,
        "purpose": "Weekly newsletter pipeline: draft generation, editorial "
        "approvals, publish + send confirmations, new-subscriber "
        "pings. Slash: /cloudless-draft rerun · "
        "/cloudless-newsletter list|send",
    },
)
print(f"purpose: ok={r.get('ok')}, error={r.get('error', 'none')}")

print(f"\n=== Posting welcome card from @{bot_name} ===")
blocks = [
    {
        "type": "header",
        "text": {"type": "plain_text", "text": ":newspaper: Newsletter Operations", "emoji": True},
    },
    {
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": "This channel receives every newsletter pipeline event:\n"
            "• :memo: Draft generated each Monday 06:00 UTC by "
            "Claude/Cloudflare\n"
            "• :rocket: Publish + send confirmations (delivered/failed "
            "counts)\n"
            "• :inbox_tray: New subscriber sign-ups in real time\n"
            "• :warning: Publisher failures with re-run buttons",
        },
    },
    {"type": "divider"},
    {
        "type": "section",
        "text": {"type": "mrkdwn", "text": "*Quick commands* (run from any channel):"},
    },
    {
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": "• `/cloudless-draft rerun` — generate a new article draft now\n"
            "• `/cloudless-newsletter list` — show pending Notion drafts\n"
            "• `/cloudless-newsletter send <slug>` — approve in Notion + "
            "publish + email subscribers\n"
            "• `/cloudless-help` — full command list",
        },
    },
]
r = slack(
    "chat.postMessage",
    bot_token,
    {"channel": ch_id, "text": "Newsletter Operations channel", "blocks": blocks},
)
print(f"welcome card: ok={r.get('ok')}, ts={r.get('ts', '')}, error={r.get('error', 'none')}")

print("\n=== Persisting NEWSLETTER_SLACK_CHANNEL_ID ===")
if cf_verify_auth():
    sys.exit(1)

print("Writing newsletter_slack_channel_id to D1... ", end="", flush=True)
print("D1 ok" if cf_config_set("NEWSLETTER_SLACK_CHANNEL_ID", ch_id) else "D1 failed")

print("Writing NEWSLETTER_SLACK_CHANNEL_ID to Wrangler... ", end="", flush=True)
print(
    "Wrangler ok" if cf_secret_set("NEWSLETTER_SLACK_CHANNEL_ID", ch_id) == 0 else "Wrangler failed"
)

gh_r = subprocess.run(
    ["gh", "secret", "set", "NEWSLETTER_SLACK_CHANNEL_ID", "--body", ch_id], capture_output=True
)
print(
    f"gh:    repo secret NEWSLETTER_SLACK_CHANNEL_ID {'set' if gh_r.returncode == 0 else 'FAILED'}"
)

print(f"""
Done. Next weekly-article-draft.yml + weekly-newsletter.yml runs will
post their pings into #{CHANNEL_NAME} via the bot (chat.postMessage),
instead of the generic SLACK_WEBHOOK_URL.

Discard the pasted user token now — it is no longer needed.""")
