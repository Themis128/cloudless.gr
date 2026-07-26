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

import { NextRequest } from "next/server";
import { listRecentCheckoutSessions, formatPrice } from "@/lib/stripe";
import { SlackClient } from "@/lib/slack-notify";
import { isSentryConfigured, getErrorCounts, getTopErrors } from "@/lib/sentry";
import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOT_USERNAME = "Cloudless";
const BOT_ICON_URL = "https://cloudless.gr/icons/icon-512.png";
const YESTERDAY_WINDOW_MS = 24 * 60 * 60 * 1_000;

// ---------------------------------------------------------------------------
// Route handler — GET only
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<Response> {
  // Verify the request is from an authorised cron caller.
  // Vercel Cron sets Authorization: Bearer <token> automatically.
  // isCronAuthorized uses a timing-safe comparison and fails closed when
  // CRON_SECRET is unset.
  if (!(await isCronAuthorized(request))) {
    return cronUnauthorized();
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
    const created = o.created ? new Date(o.created).getTime() : 0;
    return o.paymentStatus === "paid" && created >= yesterdayStart;
  });

  const totalAmount = yesterdaysOrders.reduce((sum, o) => sum + (o.amount ?? 0), 0);

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
      `_…and ${yesterdaysOrders.length - 5} more order${yesterdaysOrders.length - 5 === 1 ? "" : "s"}_`
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
// Error digest — posts overnight error summary to #errors
//
// When SENTRY_AUTH_TOKEN is configured, queries live issue counts and surfaces
// the top unresolved errors. Falls back to a static health-check ping when
// Sentry is not configured so the channel stays active regardless.
// ---------------------------------------------------------------------------

async function postErrorDigest(): Promise<void> {
  const errorsClient = new SlackClient({ channel: "#errors" });
  const ts = Math.floor(Date.now() / 1_000);
  const dateLabel = `<!date^${ts}^{date_long_pretty} at {time}|${new Date().toISOString()}>`;

  const sentryReady = await isSentryConfigured();

  if (!sentryReady) {
    // Sentry not configured — post a lightweight health-check ping so the
    // channel stays active and operators know the cron is running.
    await errorsClient.post({
      text: ":white_check_mark: Daily health check — errors channel active",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:white_check_mark: *Daily health check* — errors channel active.\nNo Sentry integration configured; skipping error counts.\n\n_${dateLabel}_`,
          },
        },
      ],
      username: BOT_USERNAME,
      icon_url: BOT_ICON_URL,
    });
    return;
  }

  // Fetch live error counts and top issues concurrently.
  const [counts, topErrors] = await Promise.all([getErrorCounts(), getTopErrors(3)]);

  // Sentry unreachable / token invalid — still post so the channel gets a
  // daily message and operators know something is wrong.
  if (!counts) {
    await errorsClient.post({
      text: ":warning: Daily error digest — Sentry unavailable",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:warning: *Daily error digest* — could not reach Sentry API. Check \`SENTRY_AUTH_TOKEN\` scopes.\n\n_${dateLabel}_`,
          },
        },
      ],
      username: BOT_USERNAME,
      icon_url: BOT_ICON_URL,
    });
    return;
  }

  // All clear — no unresolved errors or warnings.
  if (counts.total === 0) {
    await errorsClient.post({
      text: ":white_check_mark: Daily error digest — no unresolved issues",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:white_check_mark: *Daily error digest* — no unresolved issues in Sentry.\n\n_${dateLabel}_`,
          },
        },
      ],
      username: BOT_USERNAME,
      icon_url: BOT_ICON_URL,
    });
    return;
  }

  // Build summary line.
  const parts: string[] = [];
  if (counts.fatal > 0) parts.push(`${counts.fatal} fatal`);
  if (counts.error > 0) parts.push(`${counts.error} error${counts.error === 1 ? "" : "s"}`);
  if (counts.warning > 0) parts.push(`${counts.warning} warning${counts.warning === 1 ? "" : "s"}`);
  const summaryLine = parts.join(", ");

  // Build top-issues list (up to 3).
  const issueLines =
    topErrors.length > 0
      ? topErrors.map((issue) => {
          const level =
            issue.level === "fatal"
              ? ":red_circle:"
              : issue.level === "error"
                ? ":large_orange_circle:"
                : ":yellow_circle:";
          const title = slackEscape(issue.title.slice(0, 80));
          const count = Number(issue.count).toLocaleString();
          return `${level} <${issue.permalink}|${title}> — ${count} event${Number(issue.count) === 1 ? "" : "s"}`;
        })
      : ["_No recent high-frequency issues found._"];

  await errorsClient.post({
    text: `:rotating_light: Daily error digest — ${summaryLine} unresolved`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: ":rotating_light: Daily Error Digest",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Fatal:*\n${counts.fatal}`,
          },
          {
            type: "mrkdwn",
            text: `*Errors:*\n${counts.error}`,
          },
          {
            type: "mrkdwn",
            text: `*Warnings:*\n${counts.warning}`,
          },
          {
            type: "mrkdwn",
            text: `*Total unresolved:*\n${counts.total}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Top issues by frequency:*\n${issueLines.join("\n")}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open Sentry", emoji: true },
            url: "https://sentry.io/organizations/baltzakisthemiscom/issues/?project=cloudless-gr&query=is%3Aunresolved&sort=freq",
            action_id: "open_sentry_issues",
            style: "danger",
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
// Utility
// ---------------------------------------------------------------------------

function slackEscape(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
