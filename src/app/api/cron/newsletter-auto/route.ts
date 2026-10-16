/**
 * GET /api/cron/newsletter-auto
 *
 * Generates a weekly newsletter article with Cloudflare Workers AI, stores it
 * in the R2 datalake so it appears on /blog, and emails it to every EspoCRM
 * newsletter subscriber.
 *
 * Auth: CRON_SECRET header (see src/lib/cron-auth.ts).
 * Schedule: Monday 09:00 Europe/Athens via the external cron/k8s CronJob.
 */

import { NextRequest } from "next/server";
import { callWorkersAiChat } from "@/lib/workers-ai-client";
import { listNewsletterSubscribers } from "@/lib/espocrm";
import { sendEmail } from "@/lib/email";
import { recordNotification } from "@/lib/admin-notifications";
import { SlackClient } from "@/lib/slack-notify";
import { getDataLakeBucketFromEnv } from "@/lib/r2-client";
import { isCronAuthorized } from "@/lib/cron-auth";
import { fetchNewsletterCover } from "@/lib/newsletter-cover";

export const runtime = "nodejs";

async function uploadNewsletterCoverToR2(
  cover: { buffer: Uint8Array | ArrayBuffer },
  slug: string
): Promise<string | null> {
  const bucket = getDataLakeBucketFromEnv();
  if (!bucket) return null;

  try {
    await bucket.put(`newsletter/covers/${slug}.png`, cover.buffer, {
      httpMetadata: { contentType: "image/png" },
    });
    return `https://cloudless.gr/api/newsletter/covers/${slug}`;
  } catch (err) {
    console.error("[newsletter-auto] cover upload failed:", err);
    return null;
  }
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

interface ExistingArticle {
  slug: string;
  title: string;
}

/** Titles + slug stems of articles already stored under newsletter/articles/.
 *  Used to steer generation away from repeats and to reject duplicates. */
async function listExistingArticles(): Promise<ExistingArticle[]> {
  const bucket = getDataLakeBucketFromEnv();
  if (!bucket) return [];
  try {
    const listed = await bucket.list({ prefix: "newsletter/articles/" });
    const articles: ExistingArticle[] = [];
    for (const obj of listed.objects ?? []) {
      const item = await bucket.get(obj.key);
      if (!item) continue;
      try {
        const parsed = JSON.parse(await item.text()) as { title?: string };
        if (parsed.title) {
          articles.push({ slug: obj.key.split("/").pop()!.replace(/\.json$/, ""), title: parsed.title });
        }
      } catch {
        // unreadable object — still dedupe on the slug stem below
        articles.push({ slug: obj.key.split("/").pop()!.replace(/\.json$/, ""), title: "" });
      }
    }
    return articles;
  } catch (err) {
    console.error("[newsletter-auto] existing-article list failed:", err);
    return [];
  }
}

function titleTokens(title: string): Set<string> {
  return new Set(
    slugify(title)
      .split("-")
      .filter((t) => t.length > 2)
  );
}

/** Jaccard similarity between title token sets; also compares the slug stem
 *  (slug minus the date prefix) so identical AI titles are caught even when
 *  only the date differs. Returns true when the article is a duplicate. */
function isDuplicateTitle(title: string, existing: ExistingArticle[]): boolean {
  const stem = slugify(title);
  const tokens = titleTokens(title);
  for (const e of existing) {
    const existingStem = e.slug.replace(/^\d{4}-\d{2}-\d{2}-/, "");
    if (stem === existingStem) return true;
    if (e.title) {
      const et = titleTokens(e.title);
      const inter = [...tokens].filter((t) => et.has(t)).length;
      const union = new Set([...tokens, ...et]).size;
      if (union > 0 && inter / union >= 0.6) return true;
    }
  }
  return false;
}

export async function GET(request: NextRequest) {
  if (!(await isCronAuthorized(request))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const system = `You are the Cloudless.gr newsletter editor. Each Monday at 09:00 Athens you write one article about cloudless.gr services, news, updates, or offers. Return ONLY valid JSON in this exact shape, no markdown, no prose:
{"title":"string","excerpt":"string","category":"Cloud|Serverless|Analytics|AI Marketing","readTime":"string","contentHTML":"string"}
The contentHTML must be a single string of well-formed HTML containing only <p>, <h2>, <ul>, <li>, <a>, and <strong> tags.`;

  const existing = await listExistingArticles();
  const avoid = existing
    .filter((e) => e.title)
    .map((e) => `- ${e.title}`)
    .join("\n");

  const buildUser = (extra: string) =>
    `Write this week's newsletter article. Date: ${today}. Make it relevant to www.cloudless.gr services and offers.\n` +
    `Articles already published — you MUST pick a genuinely different topic and title, never a retitle or date-bump of these:\n${avoid || "- (none)"}${extra}`;

  interface GeneratedArticle {
    title?: string;
    excerpt?: string;
    category?: string;
    readTime?: string;
    contentHTML?: string;
  }
  let parsed: GeneratedArticle | null = null;
  let raw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      raw = await callWorkersAiChat(
        [
          { role: "system", content: system },
          {
            role: "user",
            content: buildUser(
              attempt === 0
                ? ""
                : `\nYour previous attempt "${parsed?.title ?? ""}" was rejected as a duplicate of an existing article. Choose a completely different subject.`
            ),
          },
        ],
        { maxTokens: 2500 }
      );
    } catch (err) {
      console.error("[newsletter-auto] AI generation failed:", err);
      return Response.json({ error: "AI generation failed" }, { status: 502 });
    }

    parsed = extractJson(raw) as GeneratedArticle | null;
    if (!parsed || !parsed.title || !parsed.excerpt || !parsed.contentHTML) {
      return Response.json({ error: "AI did not return a usable article" }, { status: 502 });
    }
    if (!isDuplicateTitle(parsed.title, existing)) break;
    if (attempt === 1) {
      console.warn(`[newsletter-auto] rejected duplicate title after retry: ${parsed.title}`);
      return Response.json(
        { error: "duplicate article rejected", title: parsed.title },
        { status: 409 }
      );
    }
  }

  if (!parsed?.title || !parsed.excerpt || !parsed.contentHTML) {
    return Response.json({ error: "AI did not return a usable article" }, { status: 502 });
  }

  const validCategories = ["Cloud", "Serverless", "Analytics", "AI Marketing"] as const;
  const category = validCategories.includes(parsed.category as (typeof validCategories)[number])
    ? (parsed.category as "Cloud" | "Serverless" | "Analytics" | "AI Marketing")
    : "Cloud";

  const slug = `${today}-${slugify(parsed.title)}`;
  const date = new Date().toISOString();
  const readTime = parsed.readTime ?? "5 min read";

  // Cover: SocialAuto renders the branded banner; failures never block the issue.
  const cover = await fetchNewsletterCover({ title: parsed.title, slug, category, date: today });
  const coverUrl = cover ? await uploadNewsletterCoverToR2(cover, slug) : null;

  const article = {
    slug,
    title: parsed.title,
    excerpt: parsed.excerpt,
    date,
    readTime,
    category,
    cover: coverUrl,
    content: stripHtml(parsed.contentHTML),
    html: parsed.contentHTML,
  };

  const bucket = getDataLakeBucketFromEnv();
  if (!bucket) {
    return Response.json({ error: "R2 datalake not configured" }, { status: 503 });
  }

  try {
    await bucket.put(`newsletter/articles/${slug}.json`, JSON.stringify(article));
  } catch (err) {
    console.error("[newsletter-auto] R2 save failed:", err);
    return Response.json({ error: "Failed to save article" }, { status: 500 });
  }

  const recipients = await listNewsletterSubscribers();
  const blogUrl = `https://cloudless.gr/blog/${slug}`;
  const subject = `${today} — ${article.title}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #e0e0e0; background: #0a0a0f; padding: 32px; border-radius: 12px;">
      ${coverUrl ? `<img src="${coverUrl}" alt="${article.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}" style="width:100%;border-radius:12px;margin-bottom:24px;" />` : ""}
      <h1 style="color: #00fff5; margin-top: 0;">${article.title}</h1>
      <p style="color: #a0a0a0;">${article.excerpt}</p>
      <hr style="border: none; border-top: 1px solid #222; margin: 24px 0;" />
      ${article.html}
      <hr style="border: none; border-top: 1px solid #222; margin: 24px 0;" />
      <p><a href="${blogUrl}" style="color: #00fff5;">Read on the blog</a></p>
      <p style="color: #555; font-size: 12px;">
        <a href="%UNSUBSCRIBELINK%" style="color: #555;">Unsubscribe</a>
      </p>
    </div>
  `.trim();
  const text = `${article.title}\n\n${article.excerpt}\n\n${article.content}\n\nRead on the blog: ${blogUrl}\n\nUnsubscribe: %UNSUBSCRIBELINK%`;

  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    const unsubscribeUrl = `https://cloudless.gr/api/unsubscribe?email=${encodeURIComponent(to)}`;
    try {
      await sendEmail({
        to,
        subject,
        fromLabel: "Cloudless",
        html: html.replaceAll("%UNSUBSCRIBELINK%", unsubscribeUrl),
        text: text.replaceAll("%UNSUBSCRIBELINK%", unsubscribeUrl),
        listUnsubscribeUrl: unsubscribeUrl,
      }); // NOSONAR -- sequential delivery avoids provider rate limiting
      sent++;
    } catch (err) {
      failed++;
      console.error(`[newsletter-auto] delivery to ${to} failed:`, err);
    }
  }

  recordNotification({
    category: "subscribe",
    type: "success",
    title: "Weekly newsletter sent",
    message: `${subject} — ${sent} sent, ${failed} failed`,
    actor: "cron",
    route: "/api/cron/newsletter-auto",
    metadata: { slug, recipients: recipients.length, sent, failed },
  }).catch((err) => console.warn("[newsletter-auto] recordNotification failed:", err));

  const slack = new SlackClient({ channel: "#newsletter" });
  slack
    .post({
      text: `Weekly newsletter sent: ${subject} to ${sent} subscribers`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "Weekly Newsletter Sent" },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${article.title}*\n*Sent:* ${sent} / ${recipients.length}\n*Blog:* ${blogUrl}`,
          },
        },
      ],
    })
    .catch((err) => console.warn("[newsletter-auto] Slack failed:", err));

  return Response.json({ ok: true, slug, sent, failed, total: recipients.length });
}
