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
// Event deduplication
//
// Slack retries event_callback deliveries up to 3 times if it doesn't receive
// a 200 within 3 seconds. We deduplicate on event_id to prevent processing
// the same event more than once. The TTL matches Slack's retry window.
// ---------------------------------------------------------------------------

const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** event_id → timestamp when it was first received */
const seenEventIds = new Map<string, number>();

function isDuplicate(eventId: string): boolean {
  const now = Date.now();

  // Purge entries older than the TTL on every check (lazy cleanup)
  for (const [id, ts] of seenEventIds) {
    if (now - ts > DEDUP_TTL_MS) seenEventIds.delete(id);
  }

  if (seenEventIds.has(eventId)) return true;
  seenEventIds.set(eventId, now);
  return false;
}

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
    // Deduplicate — Slack may retry the same event up to 3 times.
    if (isDuplicate(payload.event_id)) {
      return Response.json({ ok: true });
    }

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
    replyText = ":white_check_mark: cloudless.gr is *online*. All systems operational.";
  } else if (userText.includes("help")) {
    replyText =
      "Available slash commands:\n" +
      "• `/cloudless-status` — app health check\n" +
      "• `/cloudless-orders` — recent store orders";
  } else {
    replyText = "Hey! I'm the Cloudless bot. Try mentioning me with *status* or *help*.";
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
    }),
  });
}
