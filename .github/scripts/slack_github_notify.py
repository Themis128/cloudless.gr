#!/usr/bin/env python3
"""Build the Slack message for GitHub events (PR, release, CI failure, relay).

Reads event fields from env (wired in slack-github-notify.yml) and writes
`text=<message>` and `payload=<chat.postMessage json>` lines to
$GITHUB_OUTPUT. Empty text = nothing to post.

`repository_dispatch` mode relays messages from other repos (cu130-slim has
no Slack token — it dispatches to cloudless.gr instead).

When SLACK_BOT_TOKEN is set, the script resolves SLACK_CHANNEL_NAME in the
bot's own workspace (creating + joining the channel if needed) so the payload
always carries a channel ID the bot can actually post to.
"""

import json
import os
import urllib.parse
import urllib.request


def slack_call(method: str, data: dict | None = None, params: dict | None = None) -> dict:
    url = f"https://slack.com/api/{method}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode() if data is not None else None,
        headers={
            "Authorization": "Bearer " + os.environ["SLACK_BOT_TOKEN"],
            "Content-Type": "application/json; charset=utf-8",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def resolve_channel() -> str:
    """Find or create SLACK_CHANNEL_NAME in the bot's workspace; join it."""
    name = os.environ["SLACK_CHANNEL_NAME"].lstrip("#")
    cursor = ""
    channel_id = None
    while True:
        params = {
            "exclude_archived": "true",
            "limit": "200",
            "types": "public_channel",
            "cursor": cursor,
        }
        listing = slack_call("conversations.list", params=params)
        if not listing.get("ok"):
            raise SystemExit(f"conversations.list failed: {listing.get('error')}")
        for ch in listing.get("channels") or []:
            if ch.get("name") == name:
                channel_id = ch["id"]
                break
        if channel_id:
            break
        cursor = (listing.get("response_metadata") or {}).get("next_cursor") or ""
        if not cursor:
            break

    if not channel_id:
        created = slack_call("conversations.create", {"name": name})
        if not created.get("ok"):
            raise SystemExit(f"conversations.create failed: {created.get('error')}")
        channel_id = created["channel"]["id"]

    joined = slack_call("conversations.join", {"channel": channel_id})
    if not joined.get("ok") and joined.get("error") != "already_in_channel":
        raise SystemExit(f"conversations.join failed: {joined.get('error')}")
    return channel_id


def build() -> str | None:
    event = os.environ.get("EVENT_NAME", "")
    action = os.environ.get("ACTION", "")

    if event == "pull_request":
        num = os.environ.get("PR_NUMBER", "")
        title = os.environ.get("PR_TITLE", "")
        url = os.environ.get("PR_URL", "")
        author = os.environ.get("PR_AUTHOR", "")
        if action == "opened":
            return f"🔀 *PR <{url}|#{num}>* opened — {title} _(by {author})_"
        if action == "closed":
            merged = os.environ.get("PR_MERGED", "") == "true"
            if merged:
                return f"✅ *PR <{url}|#{num}>* merged — {title}"
            return f"⛔ *PR <{url}|#{num}>* closed without merge — {title}"

    if event == "release" and action == "published":
        tag = os.environ.get("REL_TAG", "")
        url = os.environ.get("REL_URL", "")
        return f"🏷 *Release <{url}|{tag}>* published"

    if event == "workflow_run":
        name = os.environ.get("WF_NAME", "")
        conclusion = os.environ.get("WF_CONCLUSION", "")
        branch = os.environ.get("WF_BRANCH", "")
        url = os.environ.get("WF_URL", "")
        # Only failures; never report on ourselves (avoids recursion).
        if conclusion == "failure" and name != "slack-github-notify":
            return f"❌ *<{url}|{name}>* failed on `{branch}`"

    if event == "repository_dispatch":
        text = os.environ.get("RELAY_TEXT", "")
        repo = os.environ.get("RELAY_REPO", "")
        if text:
            return f"📣 *{repo}* — {text}" if repo else text

    if event == "workflow_dispatch":
        return os.environ.get("TEST_TEXT") or "🧪 slack-github-notify test message"

    return None


def main() -> None:
    msg = build()
    payload = None
    if msg and os.environ.get("SLACK_BOT_TOKEN"):
        channel_id = resolve_channel()
        payload = {"channel": channel_id, "text": msg, "unfurl_links": False}
    with open(os.environ["GITHUB_OUTPUT"], "a") as f:
        f.write(f"text={msg or ''}\n")
        f.write(f"payload={json.dumps(payload) if payload else ''}\n")


if __name__ == "__main__":
    main()
