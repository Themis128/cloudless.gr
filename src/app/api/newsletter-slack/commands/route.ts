/**
 * Slash command endpoint for the DEDICATED Newsletter Slack app.
 *
 *   /newsletter-list         — pending Notion drafts + 3-layer gate verdict
 *   /newsletter-send         — approve + publish + email subscribers (ops)
 *   /newsletter-unpublish    — flip Status to Archived (ops)
 *   /newsletter-rerun-draft  — re-trigger weekly-article-draft.yml
 *   /newsletter-gates        — show 3-layer thresholds + last verdict summary
 *   /newsletter-stats        — subscriber count + last send time
 *   /newsletter-help         — usage cheat-sheet
 *
 * This app has its own bot token + signing secret. See
 * src/lib/newsletter-slack-{verify,config}.ts.
 */

import {
  verifyNewsletterSlackRequest,
  unauthorizedNewsletterSlack,
} from "@/lib/newsletter-slack-verify";
import { checkSlackRateLimit } from "@/lib/slack-rate-limit";
import {
  listEditorialPosts,
  findEditorialPost,
  setEditorialStatus,
  type NotionBlogDraft,
} from "@/lib/notion-blog-admin";
import { dispatchWorkflow } from "@/lib/github-dispatch";
import { listNewsletterSubscribers as listSubscribers } from "@/lib/espocrm";
import { getNewsletterSlackConfigAsync } from "@/lib/newsletter-slack-config";

interface SlashPayload {
  command: string;
  text: string;
  user_id: string;
  user_name: string;
  channel_id: string;
  response_url: string;
  trigger_id: string;
}

const SLACK_OPS_USERS = (process.env.SLACK_OPS_USERS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export async function POST(request: Request): Promise<Response> {
  const verified = await verifyNewsletterSlackRequest(request);
  if (!verified.ok) return unauthorizedNewsletterSlack(verified.reason);

  const rateLimitKey = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkSlackRateLimit(rateLimitKey)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const params = new URLSearchParams(verified.body);
  const payload: SlashPayload = {
    command: params.get("command") ?? "",
    text: params.get("text") ?? "",
    user_id: params.get("user_id") ?? "",
    user_name: params.get("user_name") ?? "",
    channel_id: params.get("channel_id") ?? "",
    response_url: params.get("response_url") ?? "",
    trigger_id: params.get("trigger_id") ?? "",
  };

  switch (payload.command) {
    case "/newsletter-list":
      return handleList();
    case "/newsletter-send":
      return handleSend(payload);
    case "/newsletter-unpublish":
      return handleUnpublish(payload);
    case "/newsletter-rerun-draft":
      return handleRerunDraft(payload);
    case "/newsletter-gates":
      return handleGates();
    case "/newsletter-stats":
      return handleStats();
    case "/newsletter-help":
      return handleHelp();
    default:
      return slackResponse({
        response_type: "ephemeral",
        text: `Unknown command: \`${payload.command}\`. Try \`/newsletter-help\`.`,
      });
  }
}

// ---------------------------------------------------------------------------
// /newsletter-list
// ---------------------------------------------------------------------------

function formatPostLine(p: NotionBlogDraft): string {
  const statusEmoji = p.status === "In Review" ? ":eyes:" : ":memo:";
  const createdTs = p.createdAt ? Math.floor(new Date(p.createdAt).getTime() / 1000) : 0;
  const dateLabel = createdTs
    ? `<!date^${createdTs}^{date_short_pretty}|${p.createdAt.slice(0, 10)}>`
    : "—";
  const slugBit = p.slug ? `\`${p.slug}\`` : `\`${p.id.slice(0, 8)}\``;
  return `${statusEmoji} *<${p.url}|${p.title}>* — ${p.category} · ${p.readTime} · ${dateLabel}\n   ${slugBit}`;
}

async function handleList(): Promise<Response> {
  const posts = await listEditorialPosts();
  if (posts.length === 0) {
    return slackResponse({
      response_type: "ephemeral",
      text:
        ":mailbox_with_no_mail: No pending drafts in Notion. " +
        "Try `/newsletter-rerun-draft` to generate one.",
    });
  }
  return slackResponse({
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `:newspaper: Pending Drafts (${posts.length})`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: posts.map(formatPostLine).join("\n\n") },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: ":memo: = Draft (gates blocked) · :eyes: = In Review (gates passed) — `/newsletter-send <slug>` to ship",
          },
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// /newsletter-send
// ---------------------------------------------------------------------------

async function handleSend(payload: SlashPayload): Promise<Response> {
  const target = payload.text.trim();
  if (!target) {
    return slackResponse({
      response_type: "ephemeral",
      text:
        "Usage: `/newsletter-send <slug-or-notion-id>`\n" +
        "Tip: run `/newsletter-list` first to see available drafts.",
    });
  }

  if (SLACK_OPS_USERS.length > 0 && !SLACK_OPS_USERS.includes(payload.user_id)) {
    return slackResponse({
      response_type: "ephemeral",
      text:
        ":no_entry: You are not on the ops allowlist for newsletter sends. " +
        "Ask the admin to add your Slack user ID to `SLACK_OPS_USERS`.",
    });
  }

  const post = await findEditorialPost(target);
  if (!post) {
    return slackResponse({
      response_type: "ephemeral",
      text:
        `:warning: No Notion draft matching \`${target}\`. ` +
        "Run `/newsletter-list` to see what is available.",
    });
  }
  if (post.status === "Published") {
    return slackResponse({
      response_type: "ephemeral",
      text: `:information_source: *${post.title}* is already Published.`,
    });
  }

  const flipped = await setEditorialStatus(post.id, "In Review");
  if (!flipped) {
    return slackResponse({
      response_type: "ephemeral",
      text: ":warning: Failed to update Notion. Check NOTION_API_KEY in SSM.",
    });
  }

  const result = await dispatchWorkflow("weekly-newsletter.yml", "main");
  if (!result.ok) {
    return slackResponse({
      response_type: "ephemeral",
      text:
        `:warning: Notion updated to *In Review* but workflow dispatch failed ` +
        `(HTTP ${result.status}): \`${result.error.slice(0, 200)}\`.`,
    });
  }

  return slackResponse({
    response_type: "in_channel",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: ":rocket: Send Initiated", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `<@${payload.user_id}> approved *<${post.url}|${post.title}>* ` +
            `(${post.category} · ${post.readTime}) and triggered the publisher.\n\n` +
            `Workflow will render → mark Published in Notion → revalidate ` +
            `\`/blog/${post.slug}\` → SES-send to every subscriber.`,
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// /newsletter-unpublish
// ---------------------------------------------------------------------------

async function handleUnpublish(payload: SlashPayload): Promise<Response> {
  const target = payload.text.trim();
  if (!target) {
    return slackResponse({
      response_type: "ephemeral",
      text:
        "Usage: `/newsletter-unpublish <slug-or-notion-id>`\n" +
        "Flips Notion Status to `Archived`. `/blog/<slug>` will 404 within the next ISR cycle.",
    });
  }
  if (SLACK_OPS_USERS.length > 0 && !SLACK_OPS_USERS.includes(payload.user_id)) {
    return slackResponse({
      response_type: "ephemeral",
      text: ":no_entry: Not on ops allowlist (`SLACK_OPS_USERS`).",
    });
  }

  const post = await findEditorialPost(target);
  if (!post) {
    return slackResponse({
      response_type: "ephemeral",
      text: `:warning: No Notion post matching \`${target}\`.`,
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
        text: { type: "plain_text", text: ":wastebasket: Unpublished", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `<@${payload.user_id}> archived *<${post.url}|${post.title}>*.\n` +
            "Emails already in inboxes are not recallable.",
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// /newsletter-rerun-draft
// ---------------------------------------------------------------------------

async function handleRerunDraft(payload: SlashPayload): Promise<Response> {
  if (SLACK_OPS_USERS.length > 0 && !SLACK_OPS_USERS.includes(payload.user_id)) {
    return slackResponse({
      response_type: "ephemeral",
      text: ":no_entry: Not on ops allowlist for draft re-runs.",
    });
  }
  const result = await dispatchWorkflow("weekly-article-draft.yml", "main");
  if (!result.ok) {
    return slackResponse({
      response_type: "ephemeral",
      text:
        `:warning: Re-run failed (HTTP ${result.status}): ` + `\`${result.error.slice(0, 200)}\``,
    });
  }
  return slackResponse({
    response_type: "ephemeral",
    text:
      ":arrows_counterclockwise: Re-triggered `weekly-article-draft.yml`. " +
      "New draft will appear in Notion within ~2 minutes. " +
      "Run `/newsletter-list` to see it and the gate verdict.",
  });
}

// ---------------------------------------------------------------------------
// /newsletter-gates
// ---------------------------------------------------------------------------

function handleGates(): Response {
  return slackResponse({
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: ":shield: 3-Layer Quality Gates", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            "*Layer 1 — Deterministic (always runs):*",
            "• Word count: 700–1400",
            "• ≥3 H2 sections",
            "• No banned phrases (AI disclaimers, lorem ipsum, click-bait)",
            "• No forbidden topics (politics, crypto, competitors)",
            "• Title novelty ≤75% overlap vs last 5 posts",
            "• No placeholder tokens (TODO, <insert>, ???)",
            "",
            "*Layer 2 — LLM Critic (`@cf/meta/llama-3.1-8b-instruct-fast`):*",
            "• Min score: 7.0/10",
            "• Schema-validated JSON verdict (factuality, novelty, tone, action)",
            "• Unavailable critic → conservative HOLD (stays Draft)",
            "",
            "*Layer 3 — Human Ops Override (this app):*",
            "• `/newsletter-send <slug>` — manual override of a HOLD",
            "• `/newsletter-unpublish <slug>` — emergency rollback",
            "• Both gated on `SLACK_OPS_USERS` allowlist",
          ].join("\n"),
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Code: `scripts/article-quality-gates.ts` · Auto-promotion: `In Review` on PASS, `Draft` on HOLD",
          },
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// /newsletter-stats
// ---------------------------------------------------------------------------

async function handleStats(): Promise<Response> {
  let subscriberCount = 0;
  try {
    const subs = await listSubscribers();
    subscriberCount = subs.length;
  } catch (err) {
    console.warn("[NewsletterSlack] stats: subscriber count failed:", err);
  }

  const posts = await listEditorialPosts().catch(() => []);
  const draftCount = posts.filter((p) => p.status === "Draft").length;
  const inReviewCount = posts.filter((p) => p.status === "In Review").length;

  return slackResponse({
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: ":bar_chart: Newsletter Stats", emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Subscribers*\n${subscriberCount}` },
          { type: "mrkdwn", text: `*Pending drafts*\n${draftCount} (gates blocked)` },
          { type: "mrkdwn", text: `*In Review*\n${inReviewCount} (ready to send)` },
          { type: "mrkdwn", text: `*Cadence*\nMon 08:15 UTC draft · 11:15 publish` },
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// /newsletter-help
// ---------------------------------------------------------------------------

function handleHelp(): Response {
  return slackResponse({
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: ":newspaper: Newsletter — Commands", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            "• `/newsletter-list` — pending drafts + gate verdicts",
            "• `/newsletter-send <slug>` — approve + publish + email subscribers",
            "• `/newsletter-unpublish <slug>` — emergency rollback",
            "• `/newsletter-rerun-draft` — re-generate this week's draft",
            "• `/newsletter-gates` — show 3-layer thresholds",
            "• `/newsletter-stats` — subscribers, drafts, cadence",
            "• `/newsletter-help` — this card",
          ].join("\n"),
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "App Home (the :house: tab) shows the live 3-layer status dashboard.",
          },
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function slackResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Touch the async config getter once at module load so any missing-secret
// warning surfaces in Lambda logs before the first real request.
void getNewsletterSlackConfigAsync().catch(() => {});
