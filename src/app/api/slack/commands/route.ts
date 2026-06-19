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
 *   /cloudless-newsletter — list pending drafts, approve + send a draft
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
import {
  listEditorialPosts,
  findEditorialPost,
  setEditorialStatus,
  type NotionBlogDraft,
} from "@/lib/notion-blog-admin";
import { getLiveCampaigns, getCampaign } from "@/data/campaigns";
import { runAdHocSnapshot } from "@/lib/ad-analytics/runtime";
import { renderDigest } from "@/lib/ad-analytics/digest";

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
  if (!verified.ok) return unauthorizedSlack(verified.reason, request);

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

    case "/cloudless-newsletter":
      return handleNewsletter(payload);

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
  // The slash command now multiplexes by `payload.text`:
  //   (empty) / "stripe"   → existing Stripe revenue summary (back-compat).
  //   "ads"                → list every campaign that's wired into the
  //                          ad-analytics module + the channels it posts to.
  //   "ads <slug>"         → live LinkedIn snapshot for one campaign. Heavy
  //                          (N+1 fetches → ~3-5 s) so we use Slack's lazy-
  //                          listener pattern: ack immediately with a
  //                          "loading…" ephemeral, finish the work in the
  //                          background, then POST the final Block Kit to
  //                          `payload.response_url`.
  //   "ads help"           → usage.
  const argv = payload.text.trim().split(/\s+/).filter(Boolean);
  const head = (argv[0] ?? "").toLowerCase();

  if (head === "ads") {
    return handleAdAnalytics(payload, argv.slice(1));
  }
  // Fall through: empty text, "stripe", or anything else lands in the
  // pre-existing Stripe revenue path.
  return handleStripeAnalytics(payload);
}

async function handleStripeAnalytics(payload: SlashCommandPayload): Promise<Response> {
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
              text: `Requested by <@${payload.user_id}> · Tip: \`/cloudless-analytics ads\` for LinkedIn ad metrics`,
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

/**
 * `/cloudless-analytics ads …` — surfaces the reusable ad-analytics module
 * inside Slack.
 *
 *   ads                  → list configured campaigns
 *   ads <campaign-slug>  → live snapshot (LinkedIn pullMetrics + ICP block)
 *   ads help             → usage
 */
function handleAdAnalytics(payload: SlashCommandPayload, rest: string[]): Response {
  const arg = (rest[0] ?? "").toLowerCase();

  if (!arg || arg === "list") {
    const live = getLiveCampaigns().filter(
      (c) => (c.adPlatforms?.length ?? 0) > 0 || (c.notifyChannels?.length ?? 0) > 0
    );
    if (live.length === 0) {
      return slackResponse({
        response_type: "ephemeral",
        text:
          ":information_source: No campaigns have ad-analytics wiring yet. " +
          "Add `adPlatforms[]` and `notifyChannels[]` to a campaign in " +
          "`src/data/campaigns.ts` and redeploy.",
      });
    }
    const rows = live.map((c) => {
      const platforms = (c.adPlatforms ?? [])
        .map((p) => `${p.platform}(${p.campaignIds.length} ids)`)
        .join(", ");
      const channels = (c.notifyChannels ?? []).map((ch) => `${ch.target}(${ch.level})`).join(", ");
      return `• *${c.slug}* — platforms: ${platforms || "—"} · channels: ${channels || "—"}`;
    });
    return slackResponse({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: ":chart_with_upwards_trend: Ad analytics — campaigns",
            emoji: true,
          },
        },
        { type: "section", text: { type: "mrkdwn", text: rows.join("\n") } },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text:
                "Snapshot one with `/cloudless-analytics ads <slug>`. " +
                `Requested by <@${payload.user_id}>.`,
            },
          ],
        },
      ],
    });
  }

  if (arg === "help") {
    return slackResponse({
      response_type: "ephemeral",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              "*`/cloudless-analytics ads` — subcommands*",
              "• `/cloudless-analytics ads` — list configured campaigns + channels",
              "• `/cloudless-analytics ads <slug>` — live snapshot (impressions / clicks / CTR / spend / CPC + ICP demographic breakdown)",
              "• `/cloudless-analytics ads help` — this message",
              "",
              "_Live snapshot does N+1 LinkedIn API calls, so the response arrives in 3-5 seconds after the immediate ack._",
            ].join("\n"),
          },
        },
      ],
    });
  }

  // Treat `arg` as a campaign slug.
  const campaign = getCampaign(arg);
  if (!campaign) {
    return slackResponse({
      response_type: "ephemeral",
      text:
        `:warning: No campaign named \`${arg}\`. ` +
        "Run `/cloudless-analytics ads` to see what's available.",
    });
  }
  if (!campaign.adPlatforms || campaign.adPlatforms.length === 0) {
    return slackResponse({
      response_type: "ephemeral",
      text:
        `:information_source: Campaign \`${arg}\` is configured but has no ` +
        "`adPlatforms[]` entry. Nothing to snapshot.",
    });
  }

  // Slack 3-second budget: ack immediately, do the work in the background,
  // POST the final Block Kit message to `payload.response_url`.
  void runAndReplyAdSnapshot(campaign.slug, payload.response_url, payload.user_id);

  return slackResponse({
    response_type: "ephemeral",
    text:
      `:hourglass_flowing_sand: Fetching live metrics for *${campaign.slug}* — ` +
      "snapshot will replace this message in a few seconds.",
  });
}

/**
 * Background worker for the lazy-listener pattern. Pulls fresh metrics from
 * every configured ad platform on the campaign, renders the same digest the
 * scheduled poll uses, and POSTs the result to Slack's `response_url`.
 *
 * Never throws — failures surface as a Block Kit error message at
 * `response_url` so the operator always gets visible feedback instead of a
 * silent "loading…" stuck state.
 */
async function runAndReplyAdSnapshot(
  campaignSlug: string,
  responseUrl: string,
  userId: string
): Promise<void> {
  if (!responseUrl) return;
  try {
    const snapshot = await runAdHocSnapshot({ campaignSlug });
    if (!snapshot || snapshot.metrics.length === 0) {
      await postToResponseUrl(responseUrl, {
        response_type: "ephemeral",
        replace_original: true,
        text: `:warning: No metrics returned for *${campaignSlug}* — check that LINKEDIN_ACCESS_TOKEN and LINKEDIN_AD_ACCOUNT_ID are configured.`,
      });
      return;
    }
    const blocks = snapshot.metrics.flatMap((m) =>
      renderDigest({
        campaignSlug,
        current: m,
        previous: null, // on-demand snapshot has no bookmark context
        windowLabel: `live snapshot (rolling 60 min)`,
      })
    );
    blocks.push({
      type: "context",
      text: `Requested by <@${userId}>`,
    });
    await postToResponseUrl(responseUrl, {
      response_type: "ephemeral",
      replace_original: true,
      blocks,
    });
  } catch (err) {
    console.error("[Slack Commands] ad snapshot worker failed:", err);
    await postToResponseUrl(responseUrl, {
      response_type: "ephemeral",
      replace_original: true,
      text: `:warning: Ad-analytics snapshot failed: \`${((err as Error)?.message ?? "unknown").slice(0, 200)}\`.`,
    });
  }
}

async function postToResponseUrl(
  responseUrl: string,
  body: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    console.error("[Slack Commands] response_url POST failed:", err);
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
            "• `/cloudless-analytics ads` — list configured LinkedIn ad campaigns",
            "• `/cloudless-analytics ads <slug>` — live LinkedIn snapshot (impressions / clicks / CTR / spend / ICP)",
            "• `/cloudless-deploy` — deploy latest code to production",
            "• `/cloudless-draft rerun` — re-run the weekly article draft generator",
            "• `/cloudless-newsletter list` — show pending Notion drafts",
            "• `/cloudless-newsletter send <slug|id>` — approve in Notion + publish + email subscribers",
            "• `/cloudless-newsletter unpublish <slug|id>` — emergency rollback: flip Status=Archived",
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

// ---------------------------------------------------------------------------
// /cloudless-newsletter — Notion → publish chain operated from Slack
//
// Subcommands:
//   list                    — show pending Notion drafts (Draft + In Review)
//   send <slug|page-id>     — flip Status to "In Review" + dispatch the
//                             weekly-newsletter.yml workflow which:
//                               · renders the page to HTML/text
//                               · marks the row Published in Notion
//                               · revalidates /blog/[slug] on the live site
//                               · POSTs the rendered email to
//                                 /api/newsletter/send → SES → subscribers
//
// Optional SLACK_OPS_USERS allowlist gates the `send` subcommand (the
// destructive one — actually emails subscribers). `list` is read-only and
// available to anyone in the workspace.
// ---------------------------------------------------------------------------

function formatPostLine(p: NotionBlogDraft): string {
  const statusEmoji = p.status === "In Review" ? ":eyes:" : ":memo:";
  const createdTs = p.createdAt ? Math.floor(new Date(p.createdAt).getTime() / 1000) : 0;
  const dateLabel = createdTs
    ? `<!date^${createdTs}^{date_short_pretty}|${p.createdAt.slice(0, 10)}>`
    : "—";
  // Slug is the operator-friendly handle for the `send` subcommand.
  const slugBit = p.slug ? `\`${p.slug}\`` : `\`${p.id.slice(0, 8)}\``;
  return `${statusEmoji} *<${p.url}|${p.title}>* — ${p.category} · ${p.readTime} · ${dateLabel}\n   ${slugBit}`;
}

async function handleNewsletter(payload: SlashCommandPayload): Promise<Response> {
  const args = payload.text.trim().split(/\s+/).filter(Boolean);
  const sub = (args[0] ?? "").toLowerCase();

  if (sub === "list") {
    const posts = await listEditorialPosts();
    if (posts.length === 0) {
      return slackResponse({
        response_type: "ephemeral",
        text:
          ":mailbox_with_no_mail: No pending drafts in Notion. " +
          "Run `/cloudless-draft rerun` to generate one.",
      });
    }
    return slackResponse({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `:newspaper: Pending Newsletter Drafts (${posts.length})`,
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: posts.map(formatPostLine).join("\n\n"),
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "Send any of these with: `/cloudless-newsletter send <slug>`",
            },
          ],
        },
      ],
    });
  }

  if (sub === "unpublish") {
    const target = args[1];
    if (!target) {
      return slackResponse({
        response_type: "ephemeral",
        text:
          "Usage: `/cloudless-newsletter unpublish <slug-or-notion-id>`\n" +
          "Flips Notion Status to `Archived`. The post stops being indexed on the public blog. " +
          "Use this for emergency rollback of a misfired auto-promoted article. " +
          "Allowlist applies (only `SLACK_OPS_USERS` can run this).",
      });
    }

    if (SLACK_OPS_USERS.length > 0 && !SLACK_OPS_USERS.includes(payload.user_id)) {
      return slackResponse({
        response_type: "ephemeral",
        text: ":no_entry: You're not on the ops allowlist. Ask the admin to add your user ID to `SLACK_OPS_USERS`.",
      });
    }

    const post = await findEditorialPost(target);
    if (!post) {
      return slackResponse({
        response_type: "ephemeral",
        text: `:warning: Could not find a Notion post matching \`${target}\`.`,
      });
    }

    const flipped = await setEditorialStatus(post.id, "Archived");
    if (!flipped) {
      return slackResponse({
        response_type: "ephemeral",
        text: ":warning: Failed to update Notion. Check NOTION_API_KEY in SSM.",
      });
    }

    return slackResponse({
      response_type: "in_channel",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: ":wastebasket: Newsletter Unpublished", emoji: true },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              `<@${payload.user_id}> flipped *<${post.url}|${post.title}>* to Notion Status=\`Archived\`.\n\n` +
              `\`/blog/${post.slug}\` will start returning 404 within the next ISR cycle (5 min). ` +
              `The email is already in subscriber inboxes — nothing the API can do about that. ` +
              `If correction is needed, send a corrigendum via \`/cloudless-newsletter send\` for a fresh draft.`,
          },
        },
      ],
    });
  }

  if (sub === "send") {
    const target = args[1];
    if (!target) {
      return slackResponse({
        response_type: "ephemeral",
        text:
          "Usage: `/cloudless-newsletter send <slug-or-notion-id>`\n" +
          "Tip: run `/cloudless-newsletter list` first to see available drafts.",
      });
    }

    if (SLACK_OPS_USERS.length > 0 && !SLACK_OPS_USERS.includes(payload.user_id)) {
      return slackResponse({
        response_type: "ephemeral",
        text:
          ":no_entry: You're not on the ops allowlist for newsletter sends. " +
          "Ask the admin to add your Slack user ID to `SLACK_OPS_USERS`.",
      });
    }

    const post = await findEditorialPost(target);
    if (!post) {
      return slackResponse({
        response_type: "ephemeral",
        text:
          `:warning: Could not find a Notion draft matching \`${target}\`. ` +
          "Run `/cloudless-newsletter list` to see what's available.",
      });
    }

    if (post.status === "Published") {
      return slackResponse({
        response_type: "ephemeral",
        text:
          `:information_source: *${post.title}* is already Published. ` +
          "The publisher won't pick it up again. Revert Status to Draft in Notion to resend.",
      });
    }

    // Flip Status → In Review so the publisher picks it up.
    const flipped = await setEditorialStatus(post.id, "In Review");
    if (!flipped) {
      return slackResponse({
        response_type: "ephemeral",
        text:
          ":warning: Failed to update Notion status. Check NOTION_API_KEY in SSM " +
          "and that the integration is shared with the Blog database.",
      });
    }

    // Dispatch the publisher workflow.
    const result = await dispatchWorkflow("weekly-newsletter.yml", "main");
    if (!result.ok) {
      return slackResponse({
        response_type: "ephemeral",
        text:
          `:warning: Notion was updated to *In Review* but workflow dispatch failed ` +
          `(HTTP ${result.status}): \`${result.error.slice(0, 200)}\`. ` +
          "Re-run with `/cloudless-newsletter send " +
          (post.slug || post.id) +
          "` once dispatch is fixed, or trigger weekly-newsletter.yml from the Actions tab.",
      });
    }

    return slackResponse({
      response_type: "in_channel",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: ":rocket: Newsletter Send Initiated",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              `<@${payload.user_id}> approved *<${post.url}|${post.title}>* ` +
              `(${post.category} · ${post.readTime}) and triggered the publisher.\n\n` +
              "The workflow will render the page, mark it Published in Notion, revalidate " +
              `\`/blog/${post.slug}\` on the live site, and SES-send to every newsletter subscriber.`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "Check progress in the GitHub Actions tab (~5 seconds to start).",
            },
          ],
        },
      ],
    });
  }

  // No subcommand / unknown subcommand → usage.
  return slackResponse({
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: ":newspaper: /cloudless-newsletter — Usage",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            "*Subcommands:*",
            "• `list` — show pending Notion drafts (Draft + In Review)",
            "• `send <slug|notion-id>` — approve in Notion + publish + email subscribers",
            "• `unpublish <slug|notion-id>` — emergency rollback (flip Status=Archived)",
            "",
            "*Example flow:*",
            "1. `/cloudless-draft rerun` — generate a new draft (Claude → Notion)",
            "2. Quality gates auto-promote to `In Review` if they pass",
            "3. `/cloudless-newsletter list` — see pending drafts",
            "4. `/cloudless-newsletter send <slug>` — manual publish + send",
            "5. `/cloudless-newsletter unpublish <slug>` — kill a misfired post",
          ].join("\n"),
        },
      },
    ],
  });
}
