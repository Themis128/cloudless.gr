#!/usr/bin/env bash
#
# One-shot restore of the Cloudless Slack incoming webhook.
#
# CONTEXT: On 2026-05-25 Slack auto-invalidated this app's webhook
# URL because they detected it had been committed to a public GitHub
# repo (Themis128/omv-ha/k8s/n8n/n8n.yaml). Since then, every cron
# Slack ping (publish confirmation, draft-created notice, subscriber
# signup) has been silently dropped because there is no working
# SLACK_WEBHOOK_URL anywhere in SSM or GH Actions secrets.
#
# Reinstalling the app:
#   1. Re-issues a fresh webhook URL bound to a channel of your choice
#   2. Grants the bot the full manifest scope set (channels:manage,
#      channels:read, channels:join, channels:write.invites, …) —
#      this is the same set the slack-manifest-apply.yml workflow has
#      been trying to push for 30 days but couldn't, because
#      SLACK_APP_CONFIG_TOKEN was never seeded.
#
# So one reinstall replaces BOTH of these long-pending human actions:
#   • seed-slack-app-config-tokens.sh
#   • restoring the webhook
#
# HOW TO DO IT (browser, ~30 seconds):
#
#   1. Open: https://api.slack.com/apps/A0ARP8UGQLB/install-on-team
#   2. Slack shows a consent screen with the scopes from
#      slack-app.manifest.json. Click Allow.
#   3. The next page asks "Post to as a channel". Select #newsletter
#      (or any channel you want the cron pings to land in).
#   4. Slack now shows you the new "Webhook URL"
#      (https://hooks.slack.com/services/T09AF5VTK4G/...). Copy it.
#   5. Run this script and paste at the prompt.
#
# After the script:
#   • SLACK_WEBHOOK_URL is stored in SSM (SecureString) and as a GH
#     repo secret. Cron immediately starts posting to it again.
#   • The bot now has channels:manage / channels:read, so
#     scripts/setup-newsletter-channel.sh can run without a user
#     OAuth token — the bot can create #newsletter itself.

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
PREFIX="${SSM_PREFIX:-/cloudless/production}"

if ! command -v aws >/dev/null; then
  echo "ERROR: aws CLI not found." >&2; exit 1
fi
if ! command -v gh >/dev/null; then
  echo "ERROR: gh CLI not found." >&2; exit 1
fi
if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "ERROR: AWS credentials not configured. Run 'aws configure' first." >&2; exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh CLI not authenticated. Run 'gh auth login' first." >&2; exit 1
fi

# --- Paste the new webhook URL ---
if [ -t 0 ]; then
  read -r -s -p "Paste the new Webhook URL (https://hooks.slack.com/services/...): " URL
  echo
else
  echo "ERROR: stdin is not a tty — this script expects interactive paste." >&2
  exit 1
fi
case "$URL" in
  https://hooks.slack.com/services/T09AF5VTK4G/*) : ;;
  https://hooks.slack.com/services/*)
    echo "WARN: webhook is on a different workspace (expected T09AF5VTK4G prefix). Continuing anyway." >&2 ;;
  *)
    echo "ERROR: doesn't look like a Slack webhook URL." >&2; exit 1 ;;
esac

# --- Test it BEFORE storing ---
echo -n "Posting test message to verify webhook is live ... "
HTTP=$(curl -sS -o /tmp/.wh-test -w "%{http_code}" -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d '{"text":":hammer_and_wrench: cloudless newsletter pipeline — webhook restore probe (delete me if you like)"}')
if [ "$HTTP" != "200" ] || ! grep -q "ok" /tmp/.wh-test 2>/dev/null; then
  echo "FAILED (HTTP $HTTP, body=$(cat /tmp/.wh-test))"
  rm -f /tmp/.wh-test
  exit 1
fi
rm -f /tmp/.wh-test
echo "ok (Slack accepted the post)"

# --- Persist to SSM ---
echo -n "Writing $PREFIX/SLACK_WEBHOOK_URL ... "
aws ssm put-parameter --region "$REGION" \
  --name "$PREFIX/SLACK_WEBHOOK_URL" \
  --type SecureString --value "$URL" --overwrite >/dev/null
echo "ok"

# --- Persist as GH Actions repo secret (cron uses this) ---
echo -n "Setting GH Actions repo secret SLACK_WEBHOOK_URL ... "
if echo "$URL" | gh secret set SLACK_WEBHOOK_URL --body - >/dev/null 2>&1; then
  echo "ok"
else
  gh secret set SLACK_WEBHOOK_URL --body "$URL" >/dev/null
  echo "ok"
fi

echo ""
echo "Done. Next weekly-article-draft.yml + weekly-newsletter.yml runs"
echo "will post into the channel you bound the webhook to."
echo ""
echo "Discard the pasted webhook URL from your clipboard now."
