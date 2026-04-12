/**
 * Slack Events API endpoint.
 *
 * Handles:
 *   - URL verification challenge (one-time setup)
 *   - app_mention  — bot was @mentioned in a channel
 *   - message      — DM or channel message (filtered to bot DMs)
 *
 * All incoming requests are verified using the Slack signing secret before
 * any payload is processed.
 *
 * Slack app setup:
 *   Event Subscriptions → Request URL: https://cloudless.gr/api/slack/events
 *   Subscribe to bot events: app_mention, message.im
 */

import { verifySlackRequest, unauthorizedSlack } from "@/lib/slack-verify";
import { getSlackConfig } from "@/lib/integrations";

// ---------------------------------------------------------------------------
// Types (subset of Slack Events API payloads)
// ---------------------------------------------------------------------------

interface SlackUrlVerification {
  type: "url_verification";
  challenge: string;
  token: string;
}

interface SlackEventCallback {
  type: "event_callback";
  team_id: string;
  event: SlackEvent;
  event_id: string;
  event_time: number;
}

interface SlackEvent {
  type: string;
  user?: string;
  text?: string;
  channel?: string;
  ts?: string;
  bot_id?: string;
}

type SlackPayload = SlackUrlVerification | SlackEventCallback;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  const verified = await verifySlackRequest(request);
  if (!verified.ok) return unauthorizedSlack(verified.reason);

  let payload: SlackPayload;
  try {
    payload = JSON.parse(verified.body) as SlackPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Slack URL verification handshake (one-time during app setup)
  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  if (payload.type === "event_callback") {
    // Respond 200 immediately — Slack requires a response within 3 seconds.
    // Heavy processing should be offloaded to a background job or queue.
    handleEvent(payload.event).catch((err) => {
      console.error("[Slack Events] Handler error:", err);
    });

    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleEvent(event: SlackEvent): Promise<void> {
  // Ignore messages from bots (including ourselves) to prevent loops
  if (event.bot_id) return;

  switch (event.type) {
    case "app_mention":
      await handleAppMention(event);
      break;

    case "message":
      // Only handle DMs (channel starts with "D")
      if (event.channel?.startsWith("D")) {
        await handleDirectMessage(event);
      }
      break;

    default:
      console.warn(`[Slack Events] Unhandled event type: ${event.type}`);
  }
}

async function handleAppMention(event: SlackEvent): Promise<void> {
  const { SLACK_BOT_TOKEN } = getSlackConfig();
  if (!SLACK_BOT_TOKEN || !event.channel) return;

  const userText = (event.text ?? "").toLowerCase();

  let replyText: string;
  if (userText.includes("status")) {
    replyText =
      ":white_check_mark: cloudless.gr is *online*. All systems operational.";
  } else if (userText.includes("help")) {
    replyText =
      "Available slash commands:\n" +
      "• `/cloudless-status` — app health check\n" +
      "• `/cloudless-orders` — recent store orders";
  } else {
    replyText =
      "Hey! I'm the Cloudless bot. Try mentioning me with *status* or *help*.";
  }

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      channel: event.channel,
      thread_ts: event.ts,
      text: replyText,
    }),
  });
}

async function handleDirectMessage(event: SlackEvent): Promise<void> {
  const { SLACK_BOT_TOKEN } = getSlackConfig();
  if (!SLACK_BOT_TOKEN || !event.channel) return;

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      channel: event.channel,
      text: "Hi! I respond to slash commands — try `/cloudless-status` or `/cloudless-orders`.",
    