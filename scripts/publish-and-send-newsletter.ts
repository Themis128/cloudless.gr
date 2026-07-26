/**
 * Publisher + Newsletter Sender
 *
 * Finds Notion Blog rows with Status="In Review", promotes them to Published,
 * triggers ISR revalidation on the public blog, then asks the site's
 * newsletter send endpoint to email each post to every EspoCRM subscriber.
 *
 * Designed to run from .github/workflows/weekly-newsletter.yml on Mondays
 * at 09:00 UTC, three hours after the draft generator (the human review
 * SLA). Self-contained: reads env directly, talks to Notion and the site's
 * own API via raw fetch (no src/lib/* imports).
 *
 * Why a server endpoint for the send: delivery runs through SES, and the
 * Lambda the site runs on already holds SES permissions. Posting the
 * rendered email to /api/newsletter/send keeps AWS keys out of CI; the
 * endpoint resolves the recipient list from EspoCRM and sends.
 *
 * Flow per approved post:
 *   1. Fetch full block tree, render to HTML + plaintext.
 *   2. Atomically set Status=Published, Published=true, Date.
 *   3. POST /api/webhooks/notion (page.updated, blog) to revalidate.
 *   4. POST /api/newsletter/send with the rendered email.
 *   5. Slack-ping with subject, slug, and delivered/failed counts.
 *
 * If zero rows match, exit 0 with a "nothing approved" log line.
 * No empty newsletters.
 *
 * Required env:
 *   NOTION_API_KEY, NOTION_BLOG_DB_ID, NOTION_WEBHOOK_SECRET
 *   NEWSLETTER_SEND_SECRET
 *   SITE_URL                    (default: https://cloudless.gr)
 *   SLACK_WEBHOOK_URL           (optional)
 *
 * Exit codes: 0 success or nothing-to-do, 1 hard failure
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const SITE_URL_DEFAULT = "https://cloudless.gr";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[publish-and-send-newsletter] missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

// ── Notion ────────────────────────────────────────────────────────────────────

async function notionFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireEnv("NOTION_API_KEY")}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

interface ApprovedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  readTime: string;
}

async function fetchApprovedPosts(): Promise<ApprovedPost[]> {
  const dbId = requireEnv("NOTION_BLOG_DB_ID");
  const res = await notionFetch(`/databases/${dbId}/query`, {
    method: "POST",
    body: JSON.stringify({
      filter: { property: "Status", select: { equals: "In Review" } },
      sorts: [{ timestamp: "created_time", direction: "ascending" }],
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Notion query (In Review) failed: ${res.status} ${await res.text().catch(() => "")}`
    );
  }
  const data = (await res.json()) as { results: NotionPage[] };
  return data.results.map((page) => {
    const p = page.properties ?? {};
    const get = (rt?: NotionRichText[]): string =>
      (rt ?? []).map((t) => t.plain_text ?? "").join("");
    return {
      id: page.id,
      title: get(p.Title?.title ?? p.Name?.title),
      slug: get(p.Slug?.rich_text),
      excerpt: get(p.Excerpt?.rich_text),
      category: p.Category?.select?.name ?? "Cloud",
      readTime: get(p["Read Time"]?.rich_text) || "5 min read",
    };
  });
}

/** Recursively pull all child blocks (Notion paginates at 100). */
async function fetchAllBlocks(pageId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const url =
      `/blocks/${pageId}/children?page_size=100` + (cursor ? `&start_cursor=${cursor}` : "");
    const res = await notionFetch(url);
    if (!res.ok) {
      throw new Error(
        `Notion blocks fetch failed: ${res.status} ${await res.text().catch(() => "")}`
      );
    }
    const data = (await res.json()) as {
      results: NotionBlock[];
      next_cursor?: string | null;
      has_more?: boolean;
    };
    blocks.push(...data.results);
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return blocks;
}

async function markPublished(pageId: string, today: string): Promise<void> {
  const res = await notionFetch(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: {
        Status: { select: { name: "Published" } },
        Published: { checkbox: true },
        Date: { date: { start: today } },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Notion mark-published failed: ${res.status} ${await res.text().catch(() => "")}`
    );
  }
}

// ── Block → HTML/plaintext renderer ───────────────────────────────────────────

function richTextToString(rt: NotionRichText[] | undefined): string {
  return (rt ?? []).map((t) => t.plain_text ?? "").join("");
}
function richTextToHtml(rt: NotionRichText[] | undefined): string {
  return (rt ?? [])
    .map((t) => {
      let s = escapeHtml(t.plain_text ?? "");
      const a = (t as RichTextAnnotated).annotations ?? {};
      if (a.bold) s = `<strong>${s}</strong>`;
      if (a.italic) s = `<em>${s}</em>`;
      if (a.code) s = `<code>${s}</code>`;
      const href = (t as RichTextAnnotated).href;
      if (href) s = `<a href="${escapeAttr(href)}">${s}</a>`;
      return s;
    })
    .join("");
}
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

export function blocksToHtml(blocks: NotionBlock[]): {
  html: string;
  text: string;
} {
  const htmlParts: string[] = [];
  const textParts: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listType) {
      htmlParts.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const block of blocks) {
    const type = block.type as string;
    const payload = (block[type] ?? {}) as {
      rich_text?: NotionRichText[];
    };
    const rt = payload.rich_text;
    const text = richTextToString(rt);
    const html = richTextToHtml(rt);

    if (type === "bulleted_list_item" || type === "numbered_list_item") {
      const next = type === "bulleted_list_item" ? "ul" : "ol";
      if (listType !== next) {
        closeList();
        htmlParts.push(`<${next}>`);
        listType = next;
      }
      htmlParts.push(`<li>${html}</li>`);
      textParts.push(`- ${text}`);
      continue;
    }

    closeList();

    switch (type) {
      case "heading_1":
        htmlParts.push(`<h1>${html}</h1>`);
        textParts.push(`\n# ${text}\n`);
        break;
      case "heading_2":
        htmlParts.push(`<h2>${html}</h2>`);
        textParts.push(`\n## ${text}\n`);
        break;
      case "heading_3":
        htmlParts.push(`<h3>${html}</h3>`);
        textParts.push(`\n### ${text}\n`);
        break;
      case "quote":
        htmlParts.push(`<blockquote>${html}</blockquote>`);
        textParts.push(`> ${text}`);
        break;
      case "code": {
        const lang = ((block[type] ?? {}) as { language?: string }).language;
        htmlParts.push(
          `<pre><code${lang ? ` class="language-${escapeAttr(lang)}"` : ""}>${escapeHtml(text)}</code></pre>`
        );
        textParts.push(text);
        break;
      }
      case "divider":
        htmlParts.push("<hr />");
        textParts.push("---");
        break;
      case "paragraph":
      default:
        if (text) {
          htmlParts.push(`<p>${html}</p>`);
          textParts.push(text);
        }
    }
  }
  closeList();
  return { html: htmlParts.join("\n"), text: textParts.join("\n\n") };
}

// ── Email render ──────────────────────────────────────────────────────────────

interface ServiceOffer {
  title: string;
  desc: string;
  cta: string;
  url: string;
}

export function categoryOffer(category: string, siteUrl: string): ServiceOffer {
  const contactUrl = `${siteUrl}/en/contact`;
  const offers: Record<string, ServiceOffer> = {
    Cloud: {
      title: "Free Cloud Cost Audit",
      desc: "We review your AWS bill and find savings — typically 20-40% of monthly spend. 30 minutes, no commitment.",
      cta: "Book a free audit",
      url: contactUrl,
    },
    Serverless: {
      title: "Serverless Migration Assessment",
      desc: "Is serverless the right move for your workload? We give you an honest answer in a free 30-minute architecture review.",
      cta: "Book a free review",
      url: contactUrl,
    },
    Analytics: {
      title: "Analytics Stack Review",
      desc: "Fragmented dashboards and slow queries? We scope a clean data pipeline in a single free session.",
      cta: "Book a free session",
      url: contactUrl,
    },
    "AI Marketing": {
      title: "AI Marketing Strategy Session",
      desc: "We map your funnel and identify the 2-3 AI automation wins that pay back fastest, with an implementation plan.",
      cta: "Book a free session",
      url: contactUrl,
    },
  };
  return offers[category] ?? offers["Cloud"];
}

export function renderNewsletter(post: ApprovedPost, body: string): string {
  const siteUrl = process.env.SITE_URL || SITE_URL_DEFAULT;
  const postUrl = `${siteUrl}/en/blog/${post.slug}`;
  const safeTitle = escapeHtml(post.title);
  const safeExcerpt = escapeHtml(post.excerpt);
  const safeCategory = escapeHtml(post.category);
  const safeReadTime = escapeHtml(post.readTime);
  const offer = categoryOffer(post.category, siteUrl);
  const safeOfferTitle = escapeHtml(offer.title);
  const safeOfferDesc = escapeHtml(offer.desc);
  const safeOfferCta = escapeHtml(offer.cta);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${safeTitle}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;line-height:1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:32px 32px 16px 32px;">
          <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#666;">${safeCategory} · ${safeReadTime}</p>
          <h1 style="margin:0 0 16px 0;font-size:28px;line-height:1.25;color:#0a0a0a;">${safeTitle}</h1>
          <p style="margin:0 0 24px 0;font-size:16px;color:#444;">${safeExcerpt}</p>
          <a href="${escapeAttr(postUrl)}" style="display:inline-block;padding:12px 24px;background:#0a0a0a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Read on cloudless.gr →</a>
        </td></tr>
        <tr><td style="padding:8px 32px 32px 32px;font-size:15px;color:#333;">
          ${body}
          <p style="margin-top:32px;"><a href="${escapeAttr(postUrl)}" style="color:#0066cc;">Continue reading on cloudless.gr →</a></p>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="3" style="background:#0a0a0a;border-radius:3px 0 0 3px;">&nbsp;</td>
              <td style="padding:16px 20px;background:#f9fafb;border-radius:0 8px 8px 0;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#666;">This Week at Cloudless</p>
                <h3 style="margin:0 0 8px;font-size:17px;color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${safeOfferTitle}</h3>
                <p style="margin:0 0 16px;font-size:13px;color:#555;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${safeOfferDesc}</p>
                <a href="${escapeAttr(offer.url)}" style="display:inline-block;padding:10px 22px;background:#0a0a0a;color:#ffffff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">${safeOfferCta} &rarr;</a>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 32px;background:#fafafa;border-top:1px solid #eaeaea;font-size:13px;color:#666;text-align:center;">
          You're receiving this because you subscribed at cloudless.gr.<br />
          <a href="%UNSUBSCRIBELINK%" style="color:#666;">Unsubscribe</a> · Cloudless, Athens, Greece
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function renderPlaintext(post: ApprovedPost, body: string): string {
  const siteUrl = process.env.SITE_URL || SITE_URL_DEFAULT;
  const postUrl = `${siteUrl}/en/blog/${post.slug}`;
  const offer = categoryOffer(post.category, siteUrl);
  return [
    `${post.title}`,
    `${post.category} · ${post.readTime}`,
    "",
    post.excerpt,
    "",
    body,
    "",
    `Read on cloudless.gr: ${postUrl}`,
    "",
    "---",
    `THIS WEEK AT CLOUDLESS: ${offer.title}`,
    offer.desc,
    `${offer.cta}: ${offer.url}`,
    "---",
    "You're receiving this because you subscribed at cloudless.gr.",
    "Unsubscribe: %UNSUBSCRIBELINK%",
  ].join("\n");
}

// ── Newsletter send endpoint ──────────────────────────────────────────────────

interface SendResult {
  sent: number;
  failed: number;
  total: number;
}

/**
 * Hands the rendered email to the site's /api/newsletter/send endpoint, which
 * resolves the EspoCRM subscriber list and delivers via SES. Authenticated
 * with the shared NEWSLETTER_SEND_SECRET.
 */
async function postNewsletter(subject: string, html: string, text: string): Promise<SendResult> {
  const siteUrl = (process.env.SITE_URL || SITE_URL_DEFAULT).replace(/\/$/, "");
  const res = await fetch(`${siteUrl}/api/newsletter/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-newsletter-secret": requireEnv("NEWSLETTER_SEND_SECRET"),
    },
    body: JSON.stringify({ subject, html, text }),
  });
  if (!res.ok) {
    throw new Error(
      `Newsletter send endpoint failed: ${res.status} ${await res.text().catch(() => "")}`
    );
  }
  return (await res.json()) as SendResult;
}

// ── ISR revalidation ──────────────────────────────────────────────────────────

async function revalidate(slug: string, pageId: string): Promise<void> {
  const siteUrl = process.env.SITE_URL || SITE_URL_DEFAULT;
  const secret = process.env.NOTION_WEBHOOK_SECRET;
  if (!secret) {
    console.warn(
      "[publish-and-send-newsletter] NOTION_WEBHOOK_SECRET not set — skipping revalidate"
    );
    return;
  }
  try {
    const res = await fetch(`${siteUrl}/api/webhooks/notion`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": secret,
      },
      body: JSON.stringify({
        type: "page.updated",
        database: "blog",
        // The webhook handler in src/app/api/webhooks/notion/route.ts
        // rejects requests with empty page_id (400). Passing the real id
        // here makes the revalidate call succeed instead of silently 400'ing
        // on every publish (which it has been since this script was written).
        page_id: pageId,
        slug,
      }),
    });
    if (!res.ok) {
      console.warn(`[publish-and-send-newsletter] revalidate failed: ${res.status}`);
    }
  } catch (err) {
    console.warn("[publish-and-send-newsletter] revalidate error:", err);
  }
}

async function slackPing(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  // Prefer the bot-token path when both NEWSLETTER_SLACK_CHANNEL_ID and
  // SLACK_BOT_TOKEN are set — it posts to the dedicated #newsletter channel
  // so the cron pings are scoped to the editorial channel instead of fanning
  // out via a generic incoming webhook.
  const botToken = process.env.SLACK_BOT_TOKEN;
  const channelId = process.env.NEWSLETTER_SLACK_CHANNEL_ID;
  if (botToken && channelId) {
    try {
      const r = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ channel: channelId, text }),
      });
      const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (data.ok) {
        console.log(
          `[publish-and-send-newsletter] Slack ping posted to ${channelId} via chat.postMessage`
        );
        return;
      }
      console.warn(
        `[publish-and-send-newsletter] chat.postMessage rejected (${data.error}), falling back to webhook`
      );
    } catch (err) {
      console.warn(
        "[publish-and-send-newsletter] chat.postMessage failed, falling back to webhook:",
        err
      );
    }
  }
  if (!url) {
    // No destination configured at all — surface this once per run so
    // operators don't wonder why no confirmation landed in any channel.
    console.warn(
      "[publish-and-send-newsletter] no Slack destination configured " +
        "(NEWSLETTER_SLACK_CHANNEL_ID + SLACK_BOT_TOKEN unset, SLACK_WEBHOOK_URL also unset) — ping skipped"
    );
    return;
  }
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    console.log("[publish-and-send-newsletter] Slack ping posted via SLACK_WEBHOOK_URL");
  } catch (err) {
    console.warn("[publish-and-send-newsletter] Slack ping failed:", err);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("[publish-and-send-newsletter] starting");
  const approved = await fetchApprovedPosts();
  if (approved.length === 0) {
    console.log(
      "[publish-and-send-newsletter] nothing approved — skipping. No newsletter will be sent."
    );
    return;
  }
  console.log(`[publish-and-send-newsletter] ${approved.length} approved post(s) to process`);

  const today = new Date().toISOString().slice(0, 10);
  for (const post of approved) {
    if (!post.slug) {
      console.error(`[publish-and-send-newsletter] post ${post.id} has empty slug — skipping`);
      await slackPing(`:warning: Skipped publishing "${post.title}" — empty slug.`);
      continue;
    }

    console.log(`[publish-and-send-newsletter] processing: "${post.title}" (${post.slug})`);
    try {
      const blocks = await fetchAllBlocks(post.id);
      const { html: bodyHtml, text: bodyText } = blocksToHtml(blocks);

      await markPublished(post.id, today);
      await revalidate(post.slug, post.id);

      const fullHtml = renderNewsletter(post, bodyHtml);
      const fullText = renderPlaintext(post, bodyText);
      const result = await postNewsletter(post.title, fullHtml, fullText);

      console.log(
        `[publish-and-send-newsletter] "${post.title}" delivered to ` +
          `${result.sent}/${result.total} subscriber(s), ${result.failed} failed`
      );
      await slackPing(
        `:rocket: Newsletter sent: *${post.title}*\n` +
          `Category: ${post.category} · Slug: ${post.slug}\n` +
          `Delivered: ${result.sent} · Failed: ${result.failed}`
      );
    } catch (err) {
      console.error(`[publish-and-send-newsletter] FAILED for "${post.title}":`, err);
      await slackPing(
        `:warning: Newsletter FAILED for "${post.title}": \`${String(
          (err as Error)?.message ?? err
        ).slice(0, 500)}\``
      );
      throw err;
    }
  }
}

// Only auto-run when invoked directly (skip during vitest imports).
if (process.argv[1]?.includes("publish-and-send-newsletter")) {
  main().catch((err) => {
    console.error("[publish-and-send-newsletter] FATAL:", err);
    process.exit(1);
  });
}

// ── Inline Notion shape declarations ──────────────────────────────────────────

interface NotionRichText {
  plain_text?: string;
}
interface RichTextAnnotated extends NotionRichText {
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
  };
  href?: string;
}
interface NotionPage {
  id: string;
  created_time?: string;
  properties: Record<string, NotionProperty>;
}
interface NotionProperty {
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  select?: { name?: string };
  date?: { start?: string };
  [key: string]: unknown;
}
type NotionBlock = Record<string, unknown>;
