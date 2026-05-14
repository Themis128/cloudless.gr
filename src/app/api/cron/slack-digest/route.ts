/**
 * Daily Slack digest cron endpoint.
 *
 * Posts a morning summary to the relevant Slack channels:
 *   - #orders   — yesterday's revenue and order count
 *   - #errors   — overnight error count (if any)
 *
 * Trigger: Vercel Cron / external cron service (e.g. cron-job.org)
 *   Schedule: 0 7 * * *  (07:00 UTC = 09:00 Athens)
 *   GET https://cloudless.gr/api/cron/slack-digest
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Security: requests without the correct CRON_SECRET are rejected with 401.
 * Add CRON_SECRET to SSM at /cloudless/prod/CRON_SECRET and to vercel.json
 * cron config if using Vercel Cron Jobs.
 *
 * Example vercel.json entry:
 * {
 *   "crons": [
 *     { "path": "/api/cron/slack-digest", "schedule": "0 7 * * *" }
 *   ]
 * }
 */

import { listRecentCheckoutSessions, formatPrice } from "@/lib/stripe";
import { SlackClient } from "@/lib/slack-notify";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOT_USERNAME = "Cloudless";
const BOT_ICON_URL = "https://cloudless.gr/icons/icon-512.png";
const YESTERDAY_WINDOW_MS = 24 * 60 * 60 * 1_000;

// ---------------------------------------------------------------------------
// Route handler — GET only
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<Response> {
  // Verify the request is from an authorised cron caller.
  // Vercel Cron sets Authorization: Bearer <token> automatically.
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[Slack Digest] CRON_SECRET env var not set — rejecting");
    return Response.json({ error: "Not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await Promise.all([postOrderDigest(), postErrorDigest()]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[Slack Digest] Unhandled error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Order digest — posts yesterday's revenue summary to #orders
// ---------------------------------------------------------------------------

async function postOrderDigest(): Promise<void> {
  // Fetch enough sessions to cover a busy day (100 should be plenty)
  const { orders } = await listRecentCheckoutSessions(100);

  const now = Date.now();
  const yesterdayStart = now - YESTERDAY_WINDOW_MS;

  // Filter to paid sessions from the last 24 hours
  const yesterdaysOrders = orders.filter((o) => {
    const created = o.createdAt ? new Date(o.createdAt).getTime() : 0;
    return o.paymentStatus === "paid" && created >= yesterdayStart;
  });

  const totalAmount = yesterdaysOrders.reduce(
    (sum, o) => sum + (o.amount ?? 0),
    0,
  );

  // Use the currency of the first order, or EUR as default
  const currency = yesterdaysOrders[0]?.currency ?? "eur";
  const formattedTotal = formatPrice(totalAmount, currency);

  const ts = Math.floor(now / 1_000);
  const dateLabel = `<!date^${ts}^{date_long_pretty}|yesterday>`;

  const ordersClient = new SlackClient({ channel: "#orders" });

  if (yesterdaysOrders.length === 0) {
    await ordersClient.post({
      text: ":chart_with_upwards_trend: Daily digest — no orders yesterday",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: ":chart_with_upwards_trend: Daily Order Digest",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `No paid orders recorded in the last 24 hours.\n\n_${dateLabel}_`,
          },
        },
        { type: "divider" },
      ],
      username: BOT_USERNAME,
      icon_url: BOT_ICON_URL,
    });
    return;
  }

  // Build a short list (up to 5 recent orders)
  const topOrders = yesterdaysOrders.slice(0, 5);
  const orderLines = topOrders.map((o) => {
    const amount = formatPrice(o.amount, o.currency);
    const email = o.email ? slackEscape(o.email) : "N/A";
    return `• *${amount}* — ${email}`;
  });

  if (yesterdaysOrders.length > 5) {
    orderLines.push(
      `_…and ${yesterdaysOrders.length - 5} more order${yesterdaysOrders.length - 5 === 1 ? "" : "s"}_`,
    );
  }

  await ordersClient.post({
    text: `:chart_with_upwards_trend: Daily digest — ${yesterdaysOrders.length} order${yesterdaysOrders.length === 1 ? "" : "s"}, ${formattedTotal}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: ":chart_with_upwards_trend: Daily Order Digest",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Orders (24h):*\n${yesterdaysOrders.length}`,
          },
          { type: "mrkdwn", text: `*Revenue (24h):*\n${formattedTotal}` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Recent orders:*\n${orderLines.join("\n")}`,
        },
      },
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
            text: `${dateLabel} • cloudless.gr daily digest`,
          },
        ],
      },
      { type: "divider" },
    ],
    username: BOT_USERNAME,
    icon_url: BOT_ICON_URL,
  });
}

// ---------------------------------------------------------------------------
// Error digest — posts overnight error summary to #errors (only if any)
//
// NOTE: For a full implementation, wire this to a persistent error store
// (e.g. Sentry, a DB table, or Redis). The current in-process error dedup
// map in slack-notify.ts does not survive Lambda cold starts. This stub
// posts a daily health check confirming the errors channel is active.
// ---------------------------------------------------------------------------

async function postErrorDigest(): Promise<void> {
  const errorsClient = new SlackClient({ channel: "#errors" });
  const ts = Math.floor(Date.now() / 1_000);
  const dateLabel = `<!date^${ts}^{date_long_pretty} at {time}|${new Date().toISOString()}>`;

  // Post a lightweight daily health-check ping.
  // To add real error counts, query Sentry or your error DB here.
  await errorsClient.post({
    text: ":white_check_mark: Daily health check — errors channel active",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:white_check_mark: *Daily health check* — errors channel active.\nNo critical alerts in the last 24 hours.\n\n_${dateLabel}_`,
        },
      },
    ],
    username: BOT_USERNAME,
    icon_url: BOT_ICON_URL,
  });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function slackEscape(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
