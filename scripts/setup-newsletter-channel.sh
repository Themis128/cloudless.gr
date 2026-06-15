#!/usr/bin/env bash
#
# One-shot bootstrap for the dedicated #newsletter Slack channel.
#
# Idempotent: safe to re-run. Does the following with a Slack USER token
# (which has the workspace admin's scopes, including channels:manage):
#   1. Creates #newsletter (or reuses if it already exists)
#   2. Invites the @cloudless_bot to it
#   3. Sets a topic + purpose
#   4. Posts a welcome card
#   5. Writes the channel ID to AWS SSM as /cloudless/production/NEWSLETTER_SLACK_CHANNEL_ID
#   6. Writes it as a GitHub Actions repository secret so the weekly
#      cron scripts pick it up
#
# WHY a USER token, not the bot token?
#   The cloudless_bot in production currently has the minimal scope set
#   (chat:write, im:*, commands, incoming-webhook). channels:manage and
#   channels:read are in the source manifest but the manifest hasn't
#   deployed yet (SLACK_APP_CONFIG_TOKEN seeding still pending). Using
#   the workspace admin's user token sidesteps that ordering problem.
#
# HOW TO MINT A USER TOKEN (browser, ~60s — one time only):
#   1. https://api.slack.com/apps  →  Your "Cloudless" app  →  OAuth & Permissions
#   2. Scroll to "User Token Scopes" → add channels:manage, channels:read,
#      channels:write.invites, groups:write (if you want private channel support)
#   3. Click "Reinstall to Workspace" (top of page) — Slack will prompt for
#      consent and return a `xoxp-...` user token.
#   4. Copy the "User OAuth Token" (starts with xoxp-).
#   5. Run this script and paste it at the prompt.
#
# After this runs, the user token is discarded — it's used only to create
# the channel + invite the bot. From then on, the bot's chat:write scope
# is enough to post into a channel it's a member of.

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
PREFIX="${SSM_PREFIX:-/cloudless/production}"
CHANNEL_NAME="newsletter"

if ! command -v aws >/dev/null; then
  echo "ERROR: aws CLI not found." >&2; exit 1
fi
if ! command -v gh >/dev/null; then
  echo "ERROR: gh CLI not found — needed to write the GH Actions secret." >&2; exit 1
fi
if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "ERROR: AWS credentials not configured. Run 'aws configure' first." >&2; exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh CLI not authenticated. Run 'gh auth login' first." >&2; exit 1
fi

# --- Get user token from stdin (silent) ---
if [ -t 0 ]; then
  read -r -s -p "Paste Slack USER OAuth token (xoxp-...): " USER_TOKEN
  echo
else
  echo "ERROR: stdin is not a tty — this script expects interactive paste." >&2
  exit 1
fi
case "$USER_TOKEN" in
  xoxp-*) : ;;
  *) echo "ERROR: token prefix is not xoxp- — that's a user token. Got something else." >&2; exit 1 ;;
esac

# --- Verify identity + scopes ---
echo -n "Verifying user token ... "
WHOAMI=$(curl -sS https://slack.com/api/auth.test -H "Authorization: Bearer $USER_TOKEN")
OK=$(echo "$WHOAMI" | jq -r .ok)
if [ "$OK" != "true" ]; then
  echo "FAILED ($(echo "$WHOAMI" | jq -r .error))"; exit 1
fi
TEAM=$(echo "$WHOAMI" | jq -r .team)
USER=$(echo "$WHOAMI" | jq -r .user)
echo "ok (team=$TEAM, user=$USER)"

# --- Get bot's user id from the bot token (for invite step) ---
BOT_TOKEN=$(aws ssm get-parameter --region "$REGION" \
  --name "$PREFIX/SLACK_BOT_TOKEN" --with-decryption --output json \
  | jq -r .Parameter.Value)
BOT_INFO=$(curl -sS https://slack.com/api/auth.test -H "Authorization: Bearer $BOT_TOKEN")
BOT_USER_ID=$(echo "$BOT_INFO" | jq -r .user_id)
BOT_NAME=$(echo "$BOT_INFO" | jq -r .user)
echo "Bot identity: @$BOT_NAME ($BOT_USER_ID)"

# --- Find or create the channel ---
echo ""
echo "=== Locating #$CHANNEL_NAME ==="
CHANNELS=$(curl -sS "https://slack.com/api/conversations.list?exclude_archived=true&limit=1000&types=public_channel" \
  -H "Authorization: Bearer $USER_TOKEN")
LIST_OK=$(echo "$CHANNELS" | jq -r .ok)
if [ "$LIST_OK" != "true" ]; then
  echo "list failed: $(echo "$CHANNELS" | jq -r '{error, needed, provided}')"; exit 1
fi
CH_ID=$(echo "$CHANNELS" | jq -r ".channels[]? | select(.name==\"$CHANNEL_NAME\") | .id // empty")

if [ -n "$CH_ID" ]; then
  echo "Channel already exists: $CH_ID"
else
  echo "Creating #$CHANNEL_NAME ..."
  CREATE=$(curl -sS -X POST https://slack.com/api/conversations.create \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json; charset=utf-8" \
    -d "{\"name\":\"$CHANNEL_NAME\",\"is_private\":false}")
  CH_ID=$(echo "$CREATE" | jq -r '.channel.id // empty')
  if [ -z "$CH_ID" ]; then
    echo "Create failed: $(echo "$CREATE" | jq '{ok, error, needed, provided}')"; exit 1
  fi
  echo "Created: $CH_ID"
fi

# --- Invite the bot ---
echo ""
echo "=== Inviting @$BOT_NAME ==="
INVITE=$(curl -sS -X POST https://slack.com/api/conversations.invite \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"channel\":\"$CH_ID\",\"users\":\"$BOT_USER_ID\"}")
INVITE_OK=$(echo "$INVITE" | jq -r .ok)
INVITE_ERR=$(echo "$INVITE" | jq -r '.error // ""')
if [ "$INVITE_OK" = "true" ] || [ "$INVITE_ERR" = "already_in_channel" ]; then
  echo "ok (${INVITE_ERR:-invited})"
else
  echo "invite failed: $INVITE"; exit 1
fi

# --- Set topic + purpose ---
echo ""
echo "=== Setting topic + purpose ==="
curl -sS -X POST https://slack.com/api/conversations.setTopic \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"channel\":\"$CH_ID\",\"topic\":\"Newsletter ops — drafts, publishes, subscriber events\"}" \
  | jq -r '"topic: ok=\(.ok), error=\(.error // \"none\")"'
curl -sS -X POST https://slack.com/api/conversations.setPurpose \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"channel\":\"$CH_ID\",\"purpose\":\"Weekly newsletter pipeline: draft generation, editorial approvals, publish + send confirmations, new-subscriber pings. Slash: /cloudless-draft rerun · /cloudless-newsletter list|send\"}" \
  | jq -r '"purpose: ok=\(.ok), error=\(.error // \"none\")"'

# --- Post a welcome card via the bot (bot is now a member, chat:write works) ---
echo ""
echo "=== Posting welcome card from @$BOT_NAME ==="
BLOCKS=$(jq -nc '[
  {type:"header", text:{type:"plain_text", text:":newspaper: Newsletter Operations", emoji:true}},
  {type:"section", text:{type:"mrkdwn", text:"This channel receives every newsletter pipeline event:\n• :memo: Draft generated each Monday 06:00 UTC by Claude/Cloudflare\n• :rocket: Publish + send confirmations (delivered/failed counts)\n• :inbox_tray: New subscriber sign-ups in real time\n• :warning: Publisher failures with re-run buttons"}},
  {type:"divider"},
  {type:"section", text:{type:"mrkdwn", text:"*Quick commands* (run from any channel):"}},
  {type:"section", text:{type:"mrkdwn", text:"• `/cloudless-draft rerun` — generate a new article draft now\n• `/cloudless-newsletter list` — show pending Notion drafts\n• `/cloudless-newsletter send <slug>` — approve in Notion + publish + email subscribers\n• `/cloudless-help` — full command list"}}
]')
curl -sS -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $BOT_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "$(jq -n --arg ch "$CH_ID" --argjson blocks "$BLOCKS" '{channel:$ch, text:"Newsletter Operations channel", blocks:$blocks}')" \
  | jq -r '"welcome card: ok=\(.ok), ts=\(.ts // \"\"), error=\(.error // \"none\")"'

# --- Persist the channel ID ---
echo ""
echo "=== Persisting NEWSLETTER_SLACK_CHANNEL_ID ==="
aws ssm put-parameter --region "$REGION" \
  --name "$PREFIX/NEWSLETTER_SLACK_CHANNEL_ID" \
  --type String --value "$CH_ID" --overwrite >/dev/null
echo "SSM:   $PREFIX/NEWSLETTER_SLACK_CHANNEL_ID = $CH_ID"

if echo "$CH_ID" | gh secret set NEWSLETTER_SLACK_CHANNEL_ID --body - >/dev/null 2>&1; then
  echo "gh:    repo secret NEWSLETTER_SLACK_CHANNEL_ID set"
else
  # Fallback for older gh versions
  gh secret set NEWSLETTER_SLACK_CHANNEL_ID --body "$CH_ID" >/dev/null
  echo "gh:    repo secret NEWSLETTER_SLACK_CHANNEL_ID set"
fi

echo ""
echo "Done. Next weekly-article-draft.yml + weekly-newsletter.yml runs will"
echo "post their pings into #$CHANNEL_NAME via the bot (chat.postMessage),"
echo "instead of the generic SLACK_WEBHOOK_URL."
echo ""
echo "Discard the pasted user token now — it is no longer needed."
