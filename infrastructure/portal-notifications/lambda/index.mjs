/**
 * SNS → Slack bridge for portal notifications.
 *
 * Trigger: SNS topic `cloudless-portal-notifications`
 * Reads SLACK_BOT_TOKEN / SLACK_WEBHOOK_URL from SSM (same keys as the main app),
 * then posts a formatted Block Kit message to the Slack #notifications channel.
 *
 * The SNS message is a JSON-serialised PortalEventPayload.  This Lambda
 * rehydrates it and builds a human-readable Slack message so the team sees
 * portal activity without digging into SNS or the admin panel.
 */
import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const SSM_PREFIX = process.env.SSM_PREFIX ?? "/cloudless/production";
const SLACK_CHANNEL = process.env.NOTIFICATIONS_CHANNEL ?? "#notifications";
const CHAT_POST_URL = "https://slack.com/api/chat.postMessage";
const MAX_RETRIES = 2;

const ssm = new SSMClient({ region: REGION });

// Cold-start cache for SSM
let _cachedToken = "";
let _cachedWebhook = "";
let _cachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function loadSlackConfig() {
  const now = Date.now();
  if (_cachedToken && now - _cachedAt < CACHE_TTL) {
    return { token: _cachedToken, webhook: _cachedWebhook };
  }

  const resp = await ssm.send(
    new GetParametersByPathCommand({ Path: SSM_PREFIX, WithDecryption: true })
  );
  const map = new Map(
    (resp.Parameters ?? []).map((p) => [p.Name?.replace(`${SSM_PREFIX}/`, ""), p.Value ?? ""])
  );
  _cachedToken = map.get("SLACK_BOT_TOKEN") ?? "";
  _cachedWebhook = map.get("SLACK_WEBHOOK_URL") ?? "";
  _cachedAt = now;
  return { token: _cachedToken, webhook: _cachedWebhook };
}

function slackEscape(text) {
  return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function buildSlackMessage(payload) {
  const emojiMap = {
    comment_added: "💬",
    deliverable_action: "📋",
    step_updated: "🔧",
    portal_created: "🎉",
  };
  const emoji = emojiMap[payload.eventType] ?? "🔔";
  const client = slackEscape(payload.clientName || payload.clientEmail);
  const project = slackEscape(payload.portalLabel);
  const desc = slackEscape((payload.description ?? "").slice(0, 1500));
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${emoji} Portal Notification — ${project}*\n*Client:* ${client}\n${desc}`,
      },
    },
  ];
  if (payload.url) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open Portal", emoji: true },
          url: payload.url,
          action_id: "open_portal",
        },
      ],
    });
  }
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `cloudless.gr · ${payload.eventType.replace("_", " ")}`,
      },
    ],
  });
  return {
    text: `[Portal] ${client} — ${payload.title}`,
    blocks,
    channel: SLACK_CHANNEL,
    unfurl_links: false,
    unfurl_media: false,
  };
}

async function postToSlack(messageBody) {
  const { token, webhook } = await loadSlackConfig();

  // Try bot token first
  if (token) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(CHAT_POST_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(messageBody),
        });
        const json = await res.json();
        if (json.ok) return true;
        // Terminal errors (invalid_auth, channel_not_found) — don't retry
        if (json.error && !["rate_limited", "internal_error"].includes(json.error)) {
          console.warn(`[SNS→Slack] Terminal error: ${json.error}`);
          return false;
        }
        if (attempt < MAX_RETRIES) {
          const delay = Math.min(1000 * 2 ** attempt, 4000);
          await new Promise((r) => setTimeout(r, delay));
        }
      } catch (err) {
        console.warn(`[SNS→Slack] Attempt ${attempt + 1} failed:`, err.message);
        if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // Fallback to webhook
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: messageBody.text, blocks: messageBody.blocks }),
      });
      if (res.ok) return true;
      console.warn(`[SNS→Slack] Webhook error: ${res.status}`);
    } catch (err) {
      console.warn("[SNS→Slack] Webhook failed:", err.message);
    }
  }

  return false;
}

export async function handler(event) {
  const records = event.Records ?? [];
  if (records.length === 0) {
    console.log("[SNS→Slack] No SNS records in event");
    return { statusCode: 200 };
  }

  for (const rec of records) {
    try {
      const snsMsg = rec.Sns;
      if (!snsMsg) continue;

      const payload = JSON.parse(snsMsg.Message);
      const messageBody = buildSlackMessage(payload);
      const sent = await postToSlack(messageBody);

      console.log(
        `[SNS→Slack] ${sent ? "✓" : "✗"} ${payload.eventType}: ${payload.clientName || payload.clientEmail} — ${payload.title}`
      );
    } catch (err) {
      console.error("[SNS→Slack] Error processing record:", err);
    }
  }

  return { statusCode: 200 };
}
