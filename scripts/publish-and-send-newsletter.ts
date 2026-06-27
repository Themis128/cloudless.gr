/**
 * Publisher + Newsletter Sender
 *
 * Finds AppFlowy blog pages named "[Review] <title>", promotes them to
 * published (strips the prefix), triggers ISR revalidation on the public
 * blog, then asks the site's newsletter send endpoint to email each post
 * to every EspoCRM subscriber.
 *
 * Designed to run from .github/workflows/weekly-newsletter.yml on Mondays
 * at 09:00 UTC, three hours after the draft generator (the human review
 * SLA). Self-contained: reads env directly, talks to AppFlowy and the
 * site's own API via raw fetch (no src/lib/* imports).
 *
 * Blog post convention (AppFlowy): name the page "[Review] <Post Title>"
 * to queue it for newsletter publication. The script renames it to just
 * "<Post Title>" after sending.
 *
 * Flow per approved post:
 *   1. Search AppFlowy for Document pages starting with "[Review]".
 *   2. Rename page to strip the "[Review]" prefix (marks as published).
 *   3. POST /api/webhooks/notion (page.updated, blog) to revalidate ISR.
 *   4. POST /api/newsletter/send with the rendered email.
 *   5. Slack-ping with subject, slug, and delivered/failed counts.
 *
 * If zero pages match, exit 0 with a "nothing approved" log line.
 * No empty newsletters.
 *
 * Required env:
 *   APPFLOWY_API_URL, APPFLOWY_EMAIL, APPFLOWY_PASSWORD
 *   NEWSLETTER_SEND_SECRET
 *   SITE_URL                    (default: https://cloudless.gr)
 *   SLACK_WEBHOOK_URL           (optional)
 *
 * Exit codes: 0 success or nothing-to-do, 1 hard failure
 */

const SITE_URL_DEFAULT = "https://cloudless.gr";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[publish-and-send-newsletter] missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

// ── AppFlowy (self-hosted Notion replacement) ─────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function appflowyLogin(): Promise<{ token: string; workspaceId: string }> {
  const base = requireEnv("APPFLOWY_API_URL").replace(/\/$/, "");
  const email = requireEnv("APPFLOWY_EMAIL");
  const password = requireEnv("APPFLOWY_PASSWORD");
  const res = await fetch(`${base}/gotrue/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`AppFlowy login failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  const token = data.access_token;
  const wsRes = await fetch(`${base}/api/workspace`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!wsRes.ok) throw new Error(`AppFlowy workspace fetch failed: ${wsRes.status}`);
  const wsData = (await wsRes.json()) as { data: Array<{ workspace_id: string }> };
  const workspaceId = wsData.data[0]?.workspace_id ?? "";
  if (!workspaceId) throw new Error("No AppFlowy workspace found");
  return { token, workspaceId };
}

interface ApprovedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  readTime: string;
}

// AppFlowy pages don't have typed "Status" properties.
// Blog posts pending review are named "[Review] <title>" in the workspace.
// Walk the folder tree and collect all Document pages with that prefix.
async function fetchApprovedPosts(): Promise<ApprovedPost[]> {
  const base = requireEnv("APPFLOWY_API_URL").replace(/\/$/, "");
  const { token, workspaceId } = await appflowyLogin();
  const res = await fetch(
    `${base}/api/workspace/${workspaceId}/folder?depth=5`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  // code -2 = workspace is empty (no spaces created yet) — not an error
  if (!res.ok) throw new Error(`AppFlowy folder fetch failed: ${res.status}`);
  const data = (await res.json()) as {
    code?: number;
    data?: Record<string, unknown>;
  };
  if (data.code !== 0) {
    console.log("[publish-and-send-newsletter] AppFlowy workspace has no content yet");
    return [];
  }

  // Flatten the nested view tree
  const views: Array<{ view_id: string; name: string; layout: string }> = [];
  function walk(node: Record<string, unknown>) {
    if (node.view_id && node.name) {
      views.push(node as { view_id: string; name: string; layout: string });
    }
    const children = (node.children as { views?: Record<string, unknown>[] })?.views ?? [];
    for (const child of children) walk(child);
  }
  walk(data.data ?? {});

  return views
    .filter((v) => v.layout === "Document" && String(v.name).startsWith("[Review]"))
    .map((v) => {
      const title = v.name.replace(/^\[Review\]\s*/, "").trim();
      return {
        id: v.view_id,
        title,
        slug: slugify(title),
        excerpt: "",
        category: "Cloud",
        readTime: "5 min read",
      };
    });
}

// AppFlowy document content is stored as rich-text delta, not block-tree.
// Return an empty block list — the email template will use title + slug link only.
async function fetchAllBlocks(_pageId: string): Promise<NotionBlock[]> {
  return [];
}

// AppFlowy has no "publish" status field — renaming the page removes the [Review] prefix.
async function markPublished(pageId: string, _today: string): Promise<void> {
  const base = requireEnv("APPFLOWY_API_URL").replace(/\/$/, "");
  const { token, workspaceId } = await appflowyLogin();
  // Fetch current name to strip the [Review] prefix
  const res = await fetch(
    `${base}/api/workspace/${workspaceId}/folder?depth=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return; // best-effort; don't block the send
  const data = (await res.json()) as { data: { views?: Array<{ view_id: string; name: string }> } };
  const view = (data.data?.views ?? []).find((v) => v.view_id === pageId);
  if (!view) return;
  const newName = view.name.replace(/^\[Review\]\s*/, "").trim();
  await fetch(`${base}/api/workspace/${workspaceId}/page-view`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ view_id: pageId, name: newName }),
  });
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
interface _NotionPage {
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
