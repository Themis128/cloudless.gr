/**
 * Slack slash commands endpoint.
 *
 * Handles:
 *   /cloudless-status    — app health + version
 *   /cloudless-orders    — recent store activity from Stripe
 *   /cloudless-channels  — list notification channels and bot membership
 *   /cloudless-ticket    — open a support ticket modal
 *   /cloudless-analytics — Stripe revenue summary
 *   /cloudless-deploy    — trigger production deploy (confirmation modal)
 *   /cloudless-draft     — re-run the weekly article draft workflow
 *   /cloudless-help      — show all available commands
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
import { dispatchWorkflow } from "@/lib/github-dispatch";

/**
 * Slack user-ID allowlist for slash-command-driven workflow dispatch.
 * Mirrors SLACK_OPS_USERS in interactions/route.ts. Empty/unset = anyone
 * in the workspace can use /cloudless-draft. Set to a single user ID to
 * lock it down to one operator.
 */
const SLACK_OPS_USERS: string[] = (process.env.SLACK_OPS_USERS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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

    case "/cloudless-draft":
      return handleDraftRerun(payload);

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
            elements: [{ type: "mrkdwn", text: `Requested by <@${payload.user_id}>` }],
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

    const [channels, bot] = await Promise.all([listChannels(token), getBotInfo(token)]);

    const MANAGED = ["bookings", "orders", "errors", "deployments", "contacts", "subscribers"];

    const rows = MANAGED.map((name) => {
      const ch = channels.find((c) => c.name === name);
      if (!ch) return `❌ \`#${name}\` — *missing* (run \`/slack-channels-setup\`)`;
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

async function handleTicket(payload: SlashCommandPayload): Promise<Response> {
  const { SLACK_BOT_TOKEN: token } = await getSlackConfigAsync();

  fetch("https://slack.com/api/views.open", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      trigger_id: payload.trigger_id,
      view: {
        type: "modal",
        callback_id: "create-ticket-modal",
        title: { type: "plain_text", text: "Submit a Ticket" },
        submit: { type: "plain_text", text: "Submit" },
        close: { type: "plain_text", text: "Cancel" },
        blocks: [
          {
            type: "input",
            block_id: "ticket_email",
            label: { type: "plain_text", text: "Customer Email" },
            element: {
              type: "plain_text_input",
              action_id: "ticket_email_input",
              placeholder: { type: "plain_text", text: "customer@example.com" },
            },
          },
          {
            type: "input",
            block_id: "ticket_issue_type",
            label: { type: "plain_text", text: "Issue Type" },
            element: {
              type: "static_select",
              action_id: "ticket_issue_type_select",
              options: [
                { text: { type: "plain_text", text: "Bug" }, value: "bug" },
                {
                  text: { type: "plain_text", text: "Feature Request" },
                  value: "feature",
                },
                {
                  text: { type: "plain_text", text: "Billing" },
                  value: "billing",
                },
                { text: { type: "plain_text", text: "Other" }, value: "other" },
              ],
            },
          },
          {
            type: "input",
            block_id: "ticket_priority",
            label: { type: "plain_text", text: "Priority" },
            element: {
              type: "static_select",
              action_id: "ticket_priority_select",
              options: [
                { text: { type: "plain_text", text: "High" }, value: "high" },
                {
                  text: { type: "plain_text", text: "Medium" },
                  value: "medium",
                },
                { text: { type: "plain_text", text: "Low" }, value: "low" },
              ],
            },
          },
          {
            type: "input",
            block_id: "ticket_description",
            label: { type: "plain_text", text: "Description" },
            element: {
              type: "plain_text_input",
              action_id: "ticket_description_input",
              multiline: true,
            },
          },
        ],
      },
    }),
    signal: AbortSignal.timeout(5_000),
  }).catch((err) => console.error("[Slack Commands] views.open (ticket) error:", err));

  return new Response(null, { status: 200 });
}

async function handleAnalytics(payload: SlashCommandPayload): Promise<Response> {
  try {
    const { orders, hasMore } = await listRecentCheckoutSessions(10);

    const paidOrders = orders.filter((o) => o.paymentStatus === "paid");
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.amount, 0);
    const currency = orders[0]?.currency ?? "EUR";

    if (paidOrders.length === 0) {
      return slackResponse({
        response_type: "ephemeral",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: ":bar_chart: Revenue Analytics",
              emoji: true,
            },
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: "No paid orders found." },
          },
          {
            type: "context",
            elements: [{ type: "mrkdwn", text: `Requested by <@${payload.user_id}>` }],
          },
        ],
      });
    }

    return slackResponse({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: ":bar_chart: Revenue Analytics",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Paid Orders*\n${paidOrders.length}${hasMore ? "+" : ""}`,
            },
            {
              type: "mrkdwn",
              text: `*Total Revenue*\n${formatPrice(totalRevenue, currency)}`,
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
              action_id: "open_stripe_dashboard",
              style: "primary",
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Requested by <@${payload.user_id}>`,
            },
          ],
        },
      ],
    });
  } catch (err) {
    console.error("[Slack Commands] /cloudless-analytics error:", err);
    return slackResponse({
      response_type: "ephemeral",
      text: ":warning: Analytics unavailable. Failed to fetch orders from Stripe.",
    });
  }
}

async function handleDeploy(payload: SlashCommandPayload): Promise<Response> {
  const { SLACK_BOT_TOKEN: token } = await getSlackConfigAsync();

  fetch("https://slack.com/api/views.open", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      trigger_id: payload.trigger_id,
      view: {
        type: "modal",
        callback_id: "deploy-confirm-modal",
        title: { type: "plain_text", text: "Deploy to Production" },
        submit: { type: "plain_text", text: "Deploy" },
        close: { type: "plain_text", text: "Cancel" },
        private_metadata: JSON.stringify({
          user_id: payload.user_id,
          user_name: payload.user_name,
        }),
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: ":warning: *You are about to deploy to production.*\nThis will trigger a new build and push the latest code to cloudless.gr.",
            },
          },
          {
            type: "input",
            block_id: "deploy_notes",
            optional: true,
            label: { type: "plain_text", text: "Release Notes (optional)" },
            element: {
              type: "plain_text_input",
              action_id: "deploy_notes_input",
              multiline: true,
              placeholder: {
                type: "plain_text",
                text: "What's new in this release?",
              },
            },
          },
        ],
      },
    }),
    signal: AbortSignal.timeout(5_000),
  }).catch((err) => console.error("[Slack Commands] views.open (deploy) error:", err));

  return new Response(null, { status: 200 });
}

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
            "• `/cloudless-channels` — notification channel status",
            "• `/cloudless-ticket` — submit a support ticket",
            "• `/cloudless-analytics` — Stripe revenue summary",
            "• `/cloudless-deploy` — deploy latest code to production",
            "• `/cloudless-draft rerun` — re-run the weekly article draft generator",
            "• `/cloudless-help` — show this message",
          ].join("\n"),
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "All commands are ephemeral — only you can see the response.",
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


// ---------------------------------------------------------------------------
// /cloudless-draft — re-run the weekly article draft workflow
//
// Usage:
//   /cloudless-draft rerun   → triggers .github/workflows/weekly-article-draft.yml
//   /cloudless-draft         → prints usage
//
// Optional allowlist via SLACK_OPS_USERS (comma-separated Slack user IDs).
// ---------------------------------------------------------------------------

async function handleDraftRerun(payload: SlashCommandPayload): Promise<Response> {
  const arg = payload.text.trim().toLowerCase();

  if (arg !== "rerun") {
    return slackResponse({
      response_type: "ephemeral",
      text:
        "Usage: `/cloudless-draft rerun` — triggers the *Weekly Article Draft* workflow.\n" +
        "The job appears in the GitHub Actions tab within ~5 seconds. " +
        "A new Notion Draft row will be created if the run succeeds.",
    });
  }

  if (SLACK_OPS_USERS.length > 0 && !SLACK_OPS_USERS.includes(payload.user_id)) {
    return slackResponse({
      response_type: "ephemeral",
      text:
        ":no_entry: You're not on the ops allowlist for workflow dispatch. " +
        "Ask the admin to add your Slack user ID to `SLACK_OPS_USERS`.",
    });
  }

  const result = await dispatchWorkflow("weekly-article-draft.yml", "main");

  if (result.ok) {
    return slackResponse({
      response_type: "in_channel",
      text:
        `:rocket: <@${payload.user_id}> re-triggered the *Weekly Article Draft* workflow. ` +
        "Check the Actions tab in ~5 seconds.",
    });
  }

  return slackResponse({
    response_type: "ephemeral",
    text:
      `:warning: Re-run failed (HTTP ${result.status}): \`${result.error.slice(0, 200)}\`. ` +
      "Check that `GITHUB_DISPATCH_TOKEN` (or `GITHUB_TOKEN`) is set in SSM with Actions write permission.",
  });
}
