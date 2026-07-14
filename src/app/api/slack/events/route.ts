/**
 * Slack Events API endpoint.
 *
 * Handles:
 *   - URL verification challenge (one-time setup)
 *   - app_mention          — bot was @mentioned in a channel
 *   - message              — DM or channel message (filtered to bot DMs)
 *   - app_home_opened      — user opens the bot's App Home tab
 *   - member_joined_channel — someone joins a managed notification channel
 *
 * All incoming requests are verified using the Slack signing secret before
 * any payload is processed.
 *
 * Slack app setup:
 *   Event Subscriptions → Request URL: https://cloudless.gr/api/slack/events
 *   Subscribe to bot events:
 *     app_mention, message.im, app_home_opened, member_joined_channel
 */

import { verifySlackRequest, unauthorizedSlack } from "@/lib/slack-verify";
import { checkSlackRateLimit } from "@/lib/slack-rate-limit";
import { SlackClient } from "@/lib/slack-notify";
import { getSlackConfigAsync } from "@/lib/integrations";

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
  channel_type?: string;
  ts?: string;
  bot_id?: string;
  tab?: string; // app_home_opened: which tab was opened
}

type SlackPayload = SlackUrlVerification | SlackEventCallback;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  const verified = await verifySlackRequest(request);
  if (!verified.ok) return unauthorizedSlack(verified.reason, request);

  // Pre-parse IP-based rate limit — coarse guard before we touch the body.
  const ipKey = `ip:${request.headers.get("x-forwarded-for") ?? "unknown"}`;
  if (!checkSlackRateLimit(ipKey)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

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
    // Post-parse per-team rate limit — Slack egress IPs are workspace-shared,
    // so the IP key alone over-aggregates. Keying by team_id keeps a noisy
    // team from starving every other workspace using the same egress pool.
    if (!checkSlackRateLimit(`team:${payload.team_id || "anon"}`)) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }
    // Deduplicate — Slack may retry the same event up to 3 times.
    if (isDuplicate(payload.event_id)) {
      return Response.json({ ok: true });
    }

    // Respond 200 immediately — Slack requires a response within 3 seconds.
    // Heavy processing is offloaded to background tasks via .catch().
    handleEvent(payload.event).catch((err) => {
      console.error("[Slack Events] Handler error:", err);
    });

    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Event dispatcher
// ---------------------------------------------------------------------------

async function handleEvent(event: SlackEvent): Promise<void> {
  // Ignore messages from bots (including ourselves) to prevent loops
  if (event.bot_id) return;

  switch (event.type) {
    case "app_mention":
      await handleAppMention(event);
      break;

    case "message":
      // Only handle DMs (channel IDs start with "D")
      if (event.channel?.startsWith("D")) {
        await handleDirectMessage(event);
      }
      break;

    case "app_home_opened":
      // Only render when the "home" tab is opened (not "messages")
      if (!event.tab || event.tab === "home") {
        await handleAppHomeOpened(event);
      }
      break;

    case "member_joined_channel":
      await handleMemberJoinedChannel(event);
      break;

    default:
      console.warn(`[Slack Events] Unhandled event type: ${event.type}`);
  }
}

// ---------------------------------------------------------------------------
// Slash command / mention help text
// ---------------------------------------------------------------------------

const HELP_TEXT =
  "Available slash commands:\n" +
  "• `/cloudless-status` — app health check\n" +
  "• `/cloudless-orders [N]` — recent Stripe orders (default 5, max 20)\n" +
  "• `/cloudless-channels` — list provisioned notification channels\n" +
  "• `/cloudless-ticket` — create a support ticket\n" +
  "• `/cloudless-analytics` — 30-day revenue & traffic summary\n" +
  "• `/cloudless-deploy` — trigger a production deployment\n" +
  "• `/cloudless-help` — show this list";

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleAppMention(event: SlackEvent): Promise<void> {
  if (!event.channel) return;

  const client = new SlackClient({ channel: event.channel });
  const userText = (event.text ?? "").toLowerCase();

  let text: string;
  if (userText.includes("status")) {
    text = ":white_check_mark: cloudless.gr is *online*. All systems operational.";
  } else if (userText.includes("help")) {
    text = HELP_TEXT;
  } else {
    text =
      "Hey! I'm the Cloudless bot. Mention me with *status* or *help*, or use `/cloudless-help` to see all commands.";
  }

  await client.post({ text, thread_ts: event.ts });
}

async function handleDirectMessage(event: SlackEvent): Promise<void> {
  if (!event.channel) return;

  const client = new SlackClient({ channel: event.channel });
  await client.post({
    text: `Hi! I respond to slash commands:\n${HELP_TEXT}`,
  });
}

// ---------------------------------------------------------------------------
// App Home tab
//
// Published via views.publish each time the user opens the Home tab.
// Requires the `im:history` scope and the App Home feature to be enabled
// in the Slack app settings (Features → App Home → Home Tab enabled).
// ---------------------------------------------------------------------------

async function handleAppHomeOpened(event: SlackEvent): Promise<void> {
  const userId = event.user;
  if (!userId) return;

  const cfg = await getSlackConfigAsync();
  const token = cfg.SLACK_BOT_TOKEN;
  if (!token) return;

  const ts = Math.floor(Date.now() / 1_000);
  const dateLabel = `<!date^${ts}^{date_long_pretty} at {time}|${new Date().toISOString()}>`;

  const view = {
    type: "home",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "☁️ Cloudless — Operations Dashboard",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Welcome back, <@${userId}>! Here's a quick overview of your cloudless.gr workspace.`,
        },
      },
      { type: "divider" },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: "*:large_green_circle: App Status*\nOnline" },
          {
            type: "mrkdwn",
            text: `*:clock1: Last checked*\n${dateLabel}`,
          },
        ],
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*:zap: Quick Commands*",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            "• `/cloudless-status` — version and uptime",
            "• `/cloudless-orders [N]` — recent Stripe orders",
            "• `/cloudless-analytics` — 30-day revenue summary",
            "• `/cloudless-ticket` — create a support ticket",
            "• `/cloudless-deploy` — trigger a production deploy",
            "• `/cloudless-channels` — check notification channel health",
          ].join("\n"),
        },
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*:hash: Notification Channels*",
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: "<#orders|orders> — Stripe payments" },
          { type: "mrkdwn", text: "<#bookings|bookings> — Consultations" },
          { type: "mrkdwn", text: "<#contacts|contacts> — Form submissions" },
          { type: "mrkdwn", text: "<#errors|errors> — App errors" },
          {
            type: "mrkdwn",
            text: "<#deployments|deployments> — Deploy events",
          },
          {
            type: "mrkdwn",
            text: "<#subscribers|subscribers> — Newsletter sign-ups",
          },
        ],
      },
      { type: "divider" },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Open Stripe Dashboard",
              emoji: true,
            },
            url: "https://dashboard.stripe.com/payments",
            action_id: "home_open_stripe",
            style: "primary",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Visit cloudless.gr",
              emoji: true,
            },
            url: "https://cloudless.gr",
            action_id: "home_open_site",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Admin Panel", emoji: true },
            url: "https://cloudless.gr/admin",
            action_id: "home_open_admin",
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Cloudless bot • <https://cloudless.gr|cloudless.gr> • This view refreshes each time you open this tab.",
          },
        ],
      },
    ],
  };

  await fetch("https://slack.com/api/views.publish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId, view }),
    signal: AbortSignal.timeout(5_000),
  });
}

// ---------------------------------------------------------------------------
// Member joined channel — welcome DM
//
// Sends a contextual DM when someone joins a managed notification channel.
// Requires im:write and chat:write scopes; conversations.open is used to
// get the DM channel ID for the new member.
// ---------------------------------------------------------------------------

/** Maps managed channel names to a short description. */
const CHANNEL_DESCRIPTIONS: Record<string, string> = {
  orders: "real-time Stripe payment notifications",
  bookings: "consultation booking confirmations from Google Calendar",
  contacts: "contact form submissions from cloudless.gr",
  errors: "application error alerts (de-duplicated, 10-min window)",
  deployments: "deploy pipeline events — started, succeeded, or failed",
  subscribers: "newsletter sign-up notifications",
};

async function handleMemberJoinedChannel(event: SlackEvent): Promise<void> {
  const userId = event.user;
  const channelId = event.channel;
  if (!userId || !channelId) return;

  // Look up the channel name so we can personalise the message.
  // We don't have the name in the event payload, so we fetch it.
  const cfg = await getSlackConfigAsync();
  const token = cfg.SLACK_BOT_TOKEN;
  if (!token) return;

  let channelName = "";
  try {
    const infoRes = await fetch(
      `https://slack.com/api/conversations.info?channel=${encodeURIComponent(channelId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5_000),
      }
    );
    const infoData = (await infoRes.json()) as any as {
      ok: boolean;
      channel?: { name: string };
    };
    channelName = infoData.channel?.name ?? "";
  } catch {
    // If we can't fetch the channel name, skip the welcome DM to avoid noise.
    return;
  }

  const description = CHANNEL_DESCRIPTIONS[channelName];
  if (!description) return; // Not a managed channel — don't send a DM.

  // Open a DM channel with the new member.
  let dmChannelId: string;
  try {
    const openRes = await fetch("https://slack.com/api/conversations.open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ users: userId }),
      signal: AbortSignal.timeout(5_000),
    });
    const openData = (await openRes.json()) as any as {
      ok: boolean;
      channel?: { id: string };
    };
    if (!openData.ok || !openData.channel?.id) return;
    dmChannelId = openData.channel.id;
  } catch {
    return;
  }

  const client = new SlackClient({ channel: dmChannelId });
  await client.post({
    text: `Welcome to #${channelName}!`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `☁️ Welcome to #${channelName}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `Hey <@${userId}>! This channel receives *${description}* posted by the Cloudless bot.\n\n` +
            "Messages are automated — no need to reply here. Use the slash commands below to interact with the bot directly.",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            "*Useful commands:*",
            "• `/cloudless-help` — see everything the bot can do",
            "• `/cloudless-status` — check app health",
            "• `/cloudless-orders` — latest Stripe activity",
            "• `/cloudless-ticket` — create a support ticket",
          ].join("\n"),
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Cloudless bot • <https://cloudless.gr|cloudless.gr>",
          },
        ],
      },
    ],
    username: "Cloudless",
    icon_url: "https://cloudless.gr/icons/icon-512.png",
  });
}
