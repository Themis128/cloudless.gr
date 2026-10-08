#!/usr/bin/env python3
"""Build the Slack message for GitHub events (PR, release, CI failure, relay).

Reads event fields from env (wired in slack-github-notify.yml) and writes
`text=<message>` and `payload=<chat.postMessage json>` lines to
$GITHUB_OUTPUT. Empty text = nothing to post.

`repository_dispatch` mode relays messages from other repos (cu130-slim has
no Slack token — it dispatches here instead).
"""

import json
import os


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
    payload = (
        {
            "channel": os.environ.get("SLACK_CHANNEL", ""),
            "text": msg,
            "unfurl_links": False,
        }
        if msg and os.environ.get("SLACK_CHANNEL")
        else None
    )
    with open(os.environ["GITHUB_OUTPUT"], "a") as f:
        f.write(f"text={msg or ''}\n")
        f.write(f"payload={json.dumps(payload) if payload else ''}\n")


if __name__ == "__main__":
    main()
