/**
 * Slack slash commands endpoint.
 *
 * Handles:
 *   /cloudless-status     — app health + version
 *   /cloudless-orders     — recent store activity from Stripe
 *   /cloudless-channels   — list notification channels and bot membership
 *   /cloudless-ticket     — open a support ticket modal
 *   /cloudless-analytics  — 30-day revenue & order summary
 *   /cloudless-deploy     — trigger a production deployment (with confirmation)
 *   /cloudless-help       — show all available commands
 *
 * Slack delivers slash command payloads as application/x-www-form-urlencoded.
 * Slack app setup:
 *   Slash Commands → create each command with Request URL:
 *   https://cloudless.gr/api/slack/commands
 */

import { verifySlackRequest, unauthorizedSlack } from "@/lib/slack-verify";
import { checkSlackRateLimit } from "@/lib/slack-rate-limit";
import { listRecentCheckoutSessions, formatPrice } from "@/lib/stripe";
import { listChannels } from "@/lib/slack-admin";
import { getBotInfo } from "@/lib/slack-workspace";
import { getSlackConfigAsync } from "@/lib/integrations";

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

    case "/cloudless-channels":
      return handleChannels(payload);

    case "/cloudless-ticket":
      return handleTicket(payload);

    case "/cloudless-analytics":
      return handleAnalytics(payload);

    case "/cloudless-deploy":
      return handleDeploy(payload);

    case "/cloudless-help":
      return handleHelp();

    default:
      return slackResponse({
        response_type: "ephemeral",
        text: `Unknown command: \`${payload.command}\`. Try \`/cloudless-help\` to see what's available.`,
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
        text: {
          type: "plain_text",
          text: ":white_check_mark: cloudless.gr Status",
          emoji: true,
        },
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
            text: {
              type: "plain_text",
              text: ":receipt: Recent Orders",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "No checkout sessions found in Stripe.",
            },
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
          text: {
            type: "plain_text",
            text: ":receipt: Recent Orders",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Showing*\n${orders.length} order${orders.length === 1 ? "" : "s"}${hasMore ? " (more available)" : ""}`,
            },
            {
              type: "mrkdwn",
              text: `*Paid Revenue*\n${formatPrice(totalRevenue, currency)}`,
            },
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
              text: {
                type: "plain_text",
                text: "Open Stripe Dashboard",
                emoji: true,
              },
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
            {
              type: "button",
              text: {
                type: "plain_text",
                text: ":arrows_counterclockwise: Refresh",
                emoji: true,
              },
              action_id: "refresh_orders",
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Requested by <@${payload.user_id}> | Tip: \`/cloudless-orders 10\` to show more`,
            },
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

async function handleChannels(payload: SlashCommandPayload): Promise<Response> {
  try {
    const { SLACK_BOT_TOKEN: token } = await getSlackConfigAsync();
    if (!token) {
      return slackResponse({
        response_type: "ephemeral",
        text: ":warning: SLACK_BOT_TOKEN is not configured.",
      });
    }

    const [channels, bot] = await Promise.all([
      listChannels(token),
      getBotInfo(token),
    ]);

    const MANAGED = [
      "bookings",
      "orders",
      "errors",
      "deployments",
      "contacts",
      "subscribers",
    ];

    const rows = MANAGED.map((name) => {
      const ch = channels.find((c) => c.name === name);
      if (!ch)
        return `❌ \`#${name}\` — *missing* (run \`/slack-channels-setup\`)`;
      const member = ch.is_member ? "✅ member" : "⚠️ not a member";
      return `• <#${ch.id}> — ${member}`;
    });

    return slackResponse({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: ":hash: cloudless.gr Notification Channels",
            emoji: true,
          },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: rows.join("\n") },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Bot: *${bot.botName}* | Workspace: *${bot.team}* | Requested by <@${payload.user_id}>`,
            },
          ],
        },
      ],
    });
  } catch (err) {
    console.error("[Slack Commands] /cloudless-channels error:", err);
    return slackResponse({
      response_type: "ephemeral",
      text: ":warning: Failed to fetch channel list. Check SLACK_BOT_TOKEN and `channels:read` scope.",
    });
  }
}

// ---------------------------------------------------------------------------
// /cloudless-ticket — opens a modal for creating support tickets
//
// Requires: im:write, chat:write scopes.
// The modal submission is handled in src/app/api/slack/interactions/route.ts
// (callback_id: "create-ticket-modal").
// ---------------------------------------------------------------------------

async function handleTicket(payload: SlashCommandPayload): Promise<Response> {
  const cfg = await getSlackConfigAsync();
  const token = cfg.SLACK_BOT_TOKEN;

  if (!token) {
    return slackResponse({
      response_type: "ephemeral",
      text: ":warning: SLACK_BOT_TOKEN is not configured. Cannot open modal.",
    });
  }

  if (!payload.trigger_id) {
    return slackResponse({
      response_type: "ephemeral",
      text: ":warning: Missing trigger_id. Cannot open modal.",
    });
  }

  const modal = {
    type: "modal",
    callback_id: "create-ticket-modal",
    title: { type: "plain_text", text: "Create Support Ticket", emoji: true },
    submit: { type: "plain_text", text: "Create Ticket", emoji: true },
    close: { type: "plain_text", text: "Cancel", emoji: true },
    private_metadata: payload.channel_id,
    blocks: [
      {
        type: "input",
        block_id: "customer_email",
        label: { type: "plain_text", text: "Customer Email", emoji: true },
        element: {
          type: "plain_text_input",
          action_id: "value",
          placeholder: { type: "plain_text", text: "customer@example.com" },
        },
      },
      {
        type: "input",
        block_id: "issue_type",
        label: { type: "plain_text", text: "Issue Type", emoji: true },
        element: {
          type: "static_select",
          action_id: "value",
          placeholder: { type: "plain_text", text: "Select a category" },
          options: [
            {
              text: { type: "plain_text", text: ":bug: Bug Report" },
              value: "bug",
            },
            {
              text: { type: "plain_text", text: ":question: General Question" },
              value: "question",
            },
            {
              text: { type: "plain_text", text: ":credit_card: Billing Issue" },
              value: "billing",
            },
            {
              text: {
                type: "plain_text",
                text: ":calendar: Booking Problem",
              },
              value: "booking",
            },
            {
              text: {
                type: "plain_text",
                text: ":bulb: Feature Request",
              },
              value: "feature",
            },
          ],
        },
      },
      {
        type: "input",
        block_id: "priority",
        label: { type: "plain_text", text: "Priority", emoji: true },
        element: {
          type: "static_select",
          action_id: "value",
          initial_option: {
            text: { type: "plain_text", text: ":large_yellow_circle: Medium" },
            value: "medium",
          },
          options: [
            {
              text: { type: "plain_text", text: ":red_circle: High" },
              value: "high",
            },
            {
              text: { type: "plain_text", text: ":large_yellow_circle: Medium" },
              value: "medium",
            },
            {
              text: { type: "plain_text", text: ":white_circle: Low" },
              value: "low",
            },
          ],
        },
      },
      {
        type: "input",
        block_id: "description",
        label: { type: "plain_text", text: "Description", emoji: true },
        element: {
          type: "plain_text_input",
          action_id: "value",
          multiline: true,
          min_length: 10,
          max_length: 3000,
          placeholder: {
            type: "plain_text",
            text: "Describe the issue in detail…",
          },
        },
      },
    ],
  };

  try {
    const res = await fetch("https://slack.com/api/views.open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ trigger_id: payload.trigger_id, view: modal }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      console.error("[Slack Commands] views.open error:", data.error);
      return slackResponse({
        response_type: "ephemeral",
        text: ":warning: Failed to open the ticket form. Please try again.",
      });
    }
  } catch (err) {
    console.error("[Slack Commands] /cloudless-ticket modal error:", err);
    return slackResponse({
      response_type: "ephemeral",
      text: ":warning: Failed to open modal. Check bot token and scopes.",
    });
  }

  // Return empty 200 — Slack will display the modal directly.
  return new Response(null, { status: 200 });
}

// ---------------------------------------------------------------------------
// /cloudless-analytics — 30-day revenue & order breakdown
// ---------------------------------------------------------------------------

async function handleAnalytics(payload: SlashCommandPayload): Promise<Response> {
  try {
    // Pull the last 100 sessions — enough for a useful 30-day picture.
    const { orders } = await listRecentCheckoutSessions(100);

    if (orders.length === 0) {
      return slackResponse({
        response_type: "ephemeral",
        text: ":bar_chart: No order data available in Stripe.",
      });
    }

    const now = Date.now() / 1_000; // Unix seconds
    const day7Cutoff = now - 7 * 24 * 60 * 60;
    const day30Cutoff = now - 30 * 24 * 60 * 60;

    const paid = orders.filter((o) => o.paymentStatus === "paid");
    const paid7 = paid.filter((o) => o.created >= day7Cutoff);
    const paid30 = paid.filter((o) => o.created >= day30Cutoff);

    const currency = orders[0]?.currency ?? "EUR";

    const sum = (arr: typeof paid) =>
      arr.reduce((acc, o) => acc + o.amount, 0);

    const rev7 = formatPrice(sum(paid7), currency);
    const rev30 = formatPrice(sum(paid30), currency);

    const subs30 = paid30.filter((o) => o.mode === "subscription").length;
    const oneTime30 = paid30.filter((o) => o.mode !== "subscription").length;

    const avg30 =
      paid30.length > 0
        ? formatPrice(Math.round(sum(paid30) / paid30.length), currency)
        : "N/A";

    return slackResponse({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: ":bar_chart: cloudless.gr Analytics",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*7-day Revenue*\n${rev7}` },
            { type: "mrkdwn", text: `*7-day Orders*\n${paid7.length}` },
            { type: "mrkdwn", text: `*30-day Revenue*\n${rev30}` },
            { type: "mrkdwn", text: `*30-day Orders*\n${paid30.length}` },
          ],
        },
        { type: "divider" },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Avg Order Value (30d)*\n${avg30}`,
            },
            {
              type: "mrkdwn",
              text: `*Subscriptions (30d)*\n${subs30} subs / ${oneTime30} one-time`,
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
                text: "Open Stripe Analytics",
                emoji: true,
              },
              url: "https://dashboard.stripe.com/analytics",
              action_id: "open_stripe_analytics",
              style: "primary",
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Requested by <@${payload.user_id}> • Based on last ${orders.length} Stripe sessions`,
            },
          ],
        },
      ],
    });
  } catch (err) {
    console.error("[Slack Commands] /cloudless-analytics error:", err);
    return slackResponse({
      response_type: "ephemeral",
      text: ":warning: Failed to fetch analytics data. Check STRIPE_SECRET_KEY in SSM.",
    });
  }
}

// ---------------------------------------------------------------------------
// /cloudless-deploy — trigger a production deployment with confirmation
//
// Opens a modal so the user must explicitly confirm before a deploy is kicked
// off. The actual workflow dispatch happens in interactions/route.ts when the
// modal is submitted (callback_id: "deploy-confirm-modal").
//
// Requires: GITHUB_TOKEN in SSM (with workflow dispatch permissions on the
// cloudless.gr repository).
// ---------------------------------------------------------------------------

async function handleDeploy(payload: SlashCommandPayload): Promise<Response> {
  const cfg = await getSlackConfigAsync();
  const token = cfg.SLACK_BOT_TOKEN;

  if (!token) {
    return slackResponse({
      response_type: "ephemeral",
      text: ":warning: SLACK_BOT_TOKEN is not configured. Cannot open modal.",
    });
  }

  if (!payload.trigger_id) {
    return slackResponse({
      response_type: "ephemeral",
      text: ":warning: Missing trigger_id. Cannot open modal.",
    });
  }

  const modal = {
    type: "modal",
    callback_id: "deploy-confirm-modal",
    title: {
      type: "plain_text",
      text: "Confirm Deployment",
      emoji: true,
    },
    submit: {
      type: "plain_text",
      text: ":rocket: Deploy to Production",
      emoji: true,
    },
    close: { type: "plain_text", text: "Cancel", emoji: true },
    private_metadata: JSON.stringify({
      user_id: payload.user_id,
      user_name: payload.user_name,
    }),
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":warning: *You are about to trigger a production deployment.*\n\nThis will run the `deploy-production` GitHub Actions workflow on the `main` branch of `cloudless.gr`. Make sure the branch is green and ready to ship.",
        },
      },
      { type: "divider" },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: "*Target*\n`cloudless.gr` (production)" },
          { type: "mrkdwn", text: "*Branch*\n`main`" },
          {
            type: "mrkdwn",
            text: `*Triggered by*\n<@${payload.user_id}>`,
          },
          {
            type: "mrkdwn",
            text: `*Time*\n<!date^${Math.floor(Date.now() / 1_000)}^{date_short_pretty} at {time}|now>`,
          },
        ],
      },
      {
        type: "input",
        block_id: "deploy_notes",
        optional: true,
        label: {
          type: "plain_text",
          text: "Release Notes (optional)",
          emoji: true,
        },
        element: {
          type: "plain_text_input",
          action_id: "value",
          multiline: true,
          max_length: 500,
          placeholder: {
            type: "plain_text",
            text: "What's in this deployment? (shown in #deployments)",
          },
        },
      },
    ],
  };

  try {
    const res = await fetch("https://slack.com/api/views.open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ trigger_id: payload.trigger_id, view: modal }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      console.error("[Slack Commands] views.open (deploy) error:", data.error);
      return slackResponse({
        response_type: "ephemeral",
        text: ":warning: Failed to open the deploy confirmation. Please try again.",
      });
    }
  } catch (err) {
    console.error("[Slack Commands] /cloudless-deploy modal error:", err);
    return slackResponse({
      response_type: "ephemeral",
      text: ":warning: Failed to open modal. Check bot token and scopes.",
    });
  }

  return new Response(null, { status: 200 });
}

// ---------------------------------------------------------------------------
// /cloudless-help
// ---------------------------------------------------------------------------

function handleHelp(): Response {
  return slackResponse({
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: ":robot_face: Cloudless Bot — Available Commands",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            "• `/cloudless-status` — app health, version, and uptime",
            "• `/cloudless-orders [N]` — last N Stripe orders (default 5, max 20)",
            "• `/cloudless-analytics` — 7-day and 30-day revenue summary",
            "• `/cloudless-ticket` — create a support ticket via a form",
            "• `/cloudless-deploy` — trigger a production deployment (requires confirmation)",
            "• `/cloudless-channels` — notification channel status and bot membership",
            "• `/cloudless-help` — show this message",
          ].join("\n"),
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "All command responses are ephemeral — only you can see them. Open the App Home tab for a live dashboard.",
          },
        ],
      },
    ],
  });
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
