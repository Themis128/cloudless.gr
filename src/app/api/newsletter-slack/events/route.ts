/**
 * Events API endpoint for the DEDICATED Newsletter Slack app.
 *
 * Handles:
 *   - url_verification         (one-time during app setup)
 *   - app_home_opened          → publishes the 3-layer status dashboard view
 *   - app_mention              → bot was @mentioned in a channel
 *   - message.im               → DM to the bot
 *
 * Uses a separate signing secret + bot token from the main Cloudless app.
 * See src/lib/newsletter-slack-{verify,config}.ts.
 */

import {
  verifyNewsletterSlackRequest,
  unauthorizedNewsletterSlack,
} from "@/lib/newsletter-slack-verify";
import { checkSlackRateLimit } from "@/lib/slack-rate-limit";
import { getNewsletterSlackConfigAsync } from "@/lib/newsletter-slack-config";
import { listEditorialPosts, type NotionBlogDraft } from "@/lib/notion-blog-admin";
import { listNewsletterSubscribers as listSubscribers } from "@/lib/espocrm";

// ---------------------------------------------------------------------------
// Event deduplication (Slack retries up to 3x within ~5min on no-200)
// ---------------------------------------------------------------------------

const DEDUP_TTL_MS = 5 * 60 * 1000;
const seenEventIds = new Map<string, number>();

function isDuplicate(eventId: string): boolean {
  const now = Date.now();
  for (const [id, ts] of seenEventIds) {
    if (now - ts > DEDUP_TTL_MS) seenEventIds.delete(id);
  }
  if (seenEventIds.has(eventId)) return true;
  seenEventIds.set(eventId, now);
  return false;
}

// ---------------------------------------------------------------------------
// Payload types (subset of Slack Events API)
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
  tab?: string;
}

type SlackPayload = SlackUrlVerification | SlackEventCallback;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  const verified = await verifyNewsletterSlackRequest(request);
  if (!verified.ok) return unauthorizedNewsletterSlack(verified.reason);

  const rateLimitKey = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkSlackRateLimit(rateLimitKey)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  let payload: SlackPayload;
  try {
    payload = JSON.parse(verified.body) as SlackPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  if (payload.type === "event_callback") {
    if (isDuplicate(payload.event_id)) {
      return Response.json({ ok: true });
    }
    // Respond 200 immediately; offload heavy work to background promise.
    handleEvent(payload.event).catch((err: unknown) => {
      console.error("[NewsletterSlack Events] handler error:", err);
    });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Event dispatch
// ---------------------------------------------------------------------------

async function handleEvent(event: SlackEvent): Promise<void> {
  if (event.bot_id) return; // ignore loopbacks

  switch (event.type) {
    case "app_home_opened":
      if (!event.tab || event.tab === "home") {
        await publishAppHome(event);
      }
      break;
    case "app_mention":
      await handleAppMention(event);
      break;
    case "message":
      if (event.channel?.startsWith("D")) {
        await handleDirectMessage(event);
      }
      break;
    default:
      console.warn(`[NewsletterSlack Events] Unhandled event type: ${event.type}`);
  }
}

// ---------------------------------------------------------------------------
// App Home — the 3-layer status dashboard
// ---------------------------------------------------------------------------

interface DashboardData {
  drafts: NotionBlogDraft[];
  subscriberCount: number;
  subscribersOk: boolean;
}

async function gatherDashboardData(): Promise<DashboardData> {
  const [drafts, subs] = await Promise.all([
    listEditorialPosts().catch((err: unknown) => {
      console.warn("[NewsletterSlack Home] listEditorialPosts failed:", err);
      return [] as NotionBlogDraft[];
    }),
    listSubscribers()
      .then((arr: string[]) => ({ ok: true, count: arr.length }))
      .catch((err: unknown) => {
        console.warn("[NewsletterSlack Home] listSubscribers failed:", err);
        return { ok: false, count: 0 };
      }),
  ]);
  return { drafts, subscriberCount: subs.count, subscribersOk: subs.ok };
}

function renderHomeView(userId: string, data: DashboardData): unknown {
  const draftCount = data.drafts.filter((p) => p.status === "Draft").length;
  const inReviewCount = data.drafts.filter((p) => p.status === "In Review").length;
  const ts = Math.floor(Date.now() / 1_000);
  const dateLabel = `<!date^${ts}^{date_short_pretty} at {time}|${new Date().toISOString()}>`;
  const subscriberCell = data.subscribersOk
    ? `*Subscribers*\n${data.subscriberCount}`
    : `*Subscribers*\n— (HubSpot error)`;

  // Current week's top draft (most recent by createdAt)
  const sorted = [...data.drafts].sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || "")
  );
  const top = sorted[0];

  const currentBlocks: unknown[] = top
    ? [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              `*This week's draft:* <${top.url}|${top.title}>\n` +
              `Category: \`${top.category}\` · ${top.readTime} · Status: \`${top.status || "—"}\`\n` +
              `Slug: \`${top.slug}\``,
          },
        },
      ]
    : [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              ":mailbox_with_no_mail: *No draft yet this week.* " +
              "Use `/newsletter-rerun-draft` to generate one.",
          },
        },
      ];

  const recentList = sorted
    .slice(0, 5)
    .map((p) => {
      const icon =
        p.status === "In Review"
          ? ":eyes:"
          : p.status === "Published"
            ? ":white_check_mark:"
            : ":memo:";
      return `${icon} <${p.url}|${p.title}> — \`${p.status || "—"}\``;
    })
    .join("\n");

  return {
    type: "home",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: ":newspaper: Newsletter — 3-Layer Control", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `Hi <@${userId}>! This is the dedicated dashboard for the cloudless.gr ` +
            "newsletter pipeline. The 3 layers (deterministic gates → LLM critic → " +
            "human ops override) are surfaced live below.",
        },
      },
      { type: "divider" },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*:hourglass_flowing_sand: Pending drafts*\n${draftCount} (gates HOLD)`,
          },
          { type: "mrkdwn", text: `*:eyes: In Review*\n${inReviewCount} (ready to send)` },
          { type: "mrkdwn", text: subscriberCell },
          { type: "mrkdwn", text: `*:clock1: Updated*\n${dateLabel}` },
        ],
      },
      { type: "divider" },
      { type: "header", text: { type: "plain_text", text: ":calendar: This Week", emoji: true } },
      ...currentBlocks,
      ...(top
        ? [
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Open in Notion", emoji: true },
                  url: top.url,
                  action_id: "home_open_notion",
                },
                {
                  type: "button",
                  style: "primary",
                  text: { type: "plain_text", text: "Send Now", emoji: true },
                  action_id: "home_send",
                  value: top.slug || top.id,
                  confirm: {
                    title: { type: "plain_text", text: "Send Newsletter?" },
                    text: {
                      type: "plain_text",
                      text: `This will email "${top.title}" to all ${data.subscriberCount} subscribers via SES. This action cannot be undone.`,
                    },
                    confirm: { type: "plain_text", text: "Send" },
                    deny: { type: "plain_text", text: "Cancel" },
                  },
                },
                {
                  type: "button",
                  style: "danger",
                  text: { type: "plain_text", text: "Unpublish", emoji: true },
                  action_id: "home_unpublish",
                  value: top.slug || top.id,
                  confirm: {
                    title: { type: "plain_text", text: "Archive post?" },
                    text: {
                      type: "plain_text",
                      text: `Flips "${top.title}" Notion Status to Archived. /blog/${top.slug} will 404 within ~5min. Already-sent emails cannot be recalled.`,
                    },
                    confirm: { type: "plain_text", text: "Archive" },
                    deny: { type: "plain_text", text: "Cancel" },
                  },
                },
              ],
            },
          ]
        : []),
      { type: "divider" },
      {
        type: "header",
        text: { type: "plain_text", text: ":scroll: Recent Drafts", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: recentList || "_(none yet)_",
        },
      },
      { type: "divider" },
      {
        type: "header",
        text: { type: "plain_text", text: ":shield: 3-Layer Gates", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*Layer 1 — Deterministic*: word count, H2 count, banned phrases, forbidden topics, title novelty, placeholder check.\n" +
            "*Layer 2 — LLM Critic*: `@cf/meta/llama-3.1-8b-instruct-fast` scores ≥7/10 with schema-validated JSON.\n" +
            "*Layer 3 — Human Ops*: this app's `/newsletter-send` & `/newsletter-unpublish` (allowlist gated).",
        },
      },
      { type: "divider" },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Re-run Draft Now", emoji: true },
            action_id: "home_rerun_draft",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Open Notion DB", emoji: true },
            url: "https://app.notion.com",
            action_id: "home_open_notion_db",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "View Live Blog", emoji: true },
            url: "https://cloudless.gr/blog",
            action_id: "home_open_blog",
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Cadence: Mon 08:15 UTC draft → 11:15 UTC publish · Code: `scripts/article-quality-gates.ts`",
          },
        ],
      },
    ],
  };
}

async function publishAppHome(event: SlackEvent): Promise<void> {
  const userId = event.user;
  if (!userId) return;

  const cfg = await getNewsletterSlackConfigAsync();
  const token = cfg.NEWSLETTER_SLACK_BOT_TOKEN;
  if (!token) {
    console.warn("[NewsletterSlack Home] no bot token — skipping views.publish");
    return;
  }

  const data = await gatherDashboardData();
  const view = renderHomeView(userId, data);

  const resp = await fetch("https://slack.com/api/views.publish", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ user_id: userId, view }),
  });
  const json = (await resp.json()) as { ok: boolean; error?: string };
  if (!json.ok) {
    console.warn(`[NewsletterSlack Home] views.publish failed: ${json.error}`);
  }
}

// ---------------------------------------------------------------------------
// App mentions + DMs — funnel users to App Home
// ---------------------------------------------------------------------------

async function postSimpleMessage(channel: string, text: string): Promise<void> {
  const cfg = await getNewsletterSlackConfigAsync();
  const token = cfg.NEWSLETTER_SLACK_BOT_TOKEN;
  if (!token) return;
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel, text }),
  }).catch((err: unknown) => console.warn("[NewsletterSlack] chat.postMessage failed:", err));
}

const HELP_TEXT =
  "Hi! I am the Newsletter bot. Use these slash commands:\n" +
  "• `/newsletter-list` — pending drafts + gate verdicts\n" +
  "• `/newsletter-send <slug>` — approve + publish + email subscribers\n" +
  "• `/newsletter-unpublish <slug>` — emergency rollback\n" +
  "• `/newsletter-rerun-draft` — re-generate this week's draft\n" +
  "• `/newsletter-gates` — show 3-layer thresholds\n" +
  "• `/newsletter-stats` — subscribers, drafts, cadence\n" +
  "Or open the :house: Home tab for the live dashboard.";

async function handleAppMention(event: SlackEvent): Promise<void> {
  if (!event.channel) return;
  await postSimpleMessage(event.channel, HELP_TEXT);
}

async function handleDirectMessage(event: SlackEvent): Promise<void> {
  if (!event.channel) return;
  await postSimpleMessage(event.channel, HELP_TEXT);
}
