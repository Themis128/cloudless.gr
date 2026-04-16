/**
 * Slack slash commands endpoint.
 *
 * Handles:
 *   /cloudless-status  — app health + version
 *   /cloudless-orders  — recent store activity from Stripe
 *
 * Slack delivers slash command payloads as application/x-www-form-urlencoded.
 * Slack app setup:
 *   Slash Commands → create each command with Request URL:
 *   https://cloudless.gr/api/slack/commands
 */

import { verifySlackRequest, unauthorizedSlack } from "@/lib/slack-verify";
import { checkSlackRateLimit } from "@/lib/slack-rate-limit";
import { listRecentCheckoutSessions, formatPrice } from "@/lib/stripe";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SlashCommandPayload {
  command: string;
  text: string;
  user_id: string;
  user_name: string;
  channel_id: string;
  response_url: string;
  trigger_id: string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  const verified = await verifySlackRequest(request);
  if (!verified.ok) return unauthorizedSlack(verified.reason);

  const rateLimitKey = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkSlackRateLimit(rateLimitKey)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const params = new URLSearchParams(verified.body);
  const payload: SlashCommandPayload = {
    command: params.get("command") ?? "",
    text: params.get("text") ?? "",
    user_id: params.get("user_id") ?? "",
    user_name: params.get("user_name") ?? "",
    channel_id: params.get("channel_id") ?? "",
    response_url: params.get("response_url") ?? "",
    trigger_id: params.get("trigger_id") ?? "",
  };

  switch (payload.command) {
    case "/cloudless-status":
      return handleStatus(payload);

    case "/cloudless-orders":
      return handleOrders(payload);

    default:
      return slackResponse({
        response_type: "ephemeral",
        text: `Unknown command: \`${payload.command}\``,
      });
  }
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

function handleStatus(_payload: SlashCommandPayload): Response {
  const version = process.env.APP_VERSION ?? "dev";
  const uptime = Math.floor(process.uptime());
  const uptimeLabel =
    uptime < 60
      ? `${uptime}s`
      : uptime < 3600
        ? `${Math.floor(uptime / 60)}m`
        : `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

  return slackResponse({
    response_type: "in_channel",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: ":white_check_mark: cloudless.gr Status", emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Version*\n\`${version}\`` },
          { type: "mrkdwn", text: `*Uptime*\n${uptimeLabel}` },
          { type: "mrkdwn", text: "*API*\n:large_green_circle: Online" },
          { type: "mrkdwn", text: "*Store*\n:large_green_circle: Online" },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<!date^${Math.floor(Date.now() / 1000)}^Checked {date_short_pretty} at {time}|${new Date().toISOString()}>`,
          },
        ],
      },
    ],
  });
}

async function handleOrders(payload: SlashCommandPayload): Promise<Response> {
  try {
    const limit = parseInt(payload.text, 10) || 5;
    const count = Math.min(Math.max(limit, 1), 20);

    const { orders, hasMore } = await listRecentCheckoutSessions(count);

    if (orders.length === 0) {
      return slackResponse({
        response_type: "ephemeral",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: ":receipt: Recent Orders", emoji: true },
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: "No checkout sessions found in Stripe." },
          },
          {
            type: "context",
            elements: [
              { type: "mrkdwn", text: `Requested by <@${payload.user_id}>` },
            ],
          },
        ],
      });
    }

    // Build summary stats
    const completedOrders = orders.filter((o) => o.paymentStatus === "paid");
    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.amount, 0);
    const currency = orders[0]?.currency ?? "EUR";

    const orderLines = orders.map((o) => {
      const status =
        o.paymentStatus === "paid"
          ? ":white_check_mark:"
          : o.paymentStatus === "unpaid"
            ? ":hourglass:"
            : ":x:";
      const date = `<!date^${o.created}^{date_short_pretty} {time}|${new Date(o.created * 1000).toISOString()}>`;
      const amount = formatPrice(o.amount, o.currency);
      const email = o.email ?? "N/A";
      const mode = o.mode === "subscription" ? " :repeat:" : "";
      return `${status} ${date} — *${amount}*${mode} — ${email}`;
    });

    return slackResponse({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: ":receipt: Recent Orders", emoji: true },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Showing*\n${orders.length} order${orders.length === 1 ? "" : "s"}${hasMore ? " (more available)" : ""}` },
            { type: "mrkdwn", text: `*Paid Revenue*\n${formatPrice(totalRevenue, currency)}` },
          ],
        },
        { type: "divider" },
        {
          type: "section",
          text: { type: "mrkdwn", text: orderLines.join("\n") },
        },
        { type: "divider" },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Open Stripe Dashboard", emoji: true },
              url: "https://dashboard.stripe.com/payments",
              action_id: "open_stripe_dashboard",
              style: "primary",
            },
            {
              type: "button",
              text: { type: "plain_text", text: "View Store", emoji: true },
              url: "https://cloudless.gr/store",
              action_id: "open_store",
            },
          ],
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `Requested by <@${payload.user_id}> | Tip: \`/cloudless-orders 10\` to show more` },
          ],
        },
      ],
    });
  } catch (err) {
    console.error("[Slack Commands] /cloudless-orders error:", err);
    return slackResponse({
      response_type: "ephemeral",
      text: ":warning: Failed to fetch orders from Stripe. Check that STRIPE_SECRET_KEY is configured in SSM.",
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SlackCommandResponse {
  response_type: "ephemeral" | "in_channel";
  text?: string;
  blocks?: unknown[];
}

function slackResponse(body: SlackCommandResponse): Response {
  return Response.json(body, {
    headers: { "Content-Type": "application/json" },
  });
}
