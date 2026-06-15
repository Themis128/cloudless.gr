/**
 * Weekly Article Generator
 *
 * Picks the least-recently-used Category from the Notion Blog database,
 * asks our /api/internal/ai/generate endpoint to author a fresh article in
 * that category (avoiding topic repetition with recent posts), and inserts
 * the result as a Draft for human review. Slack-pings the editor with a link.
 *
 * The generation endpoint tries Cloudflare Workers AI first (free tier) and
 * falls back to AWS Bedrock Claude — so this cron does NOT depend on an
 * Anthropic.com account or its credit balance.
 *
 * Designed to run from .github/workflows/weekly-article-draft.yml on
 * Monday 06:00 UTC. Self-contained — reads env directly, talks to Notion
 * via raw fetch and to Cloudflare Workers AI over HTTPS.
 *
 * AI generation strategy:
 *   1. If CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN are set, call the
 *      Workers AI REST API directly. This is the preferred path — it
 *      bypasses the cloudless.gr Cloudflare Worker (which has a 10s CPU
 *      limit on the Free plan) and lets the 70B model finish a 4096-token
 *      generation that typically takes 20-30s.
 *   2. Otherwise fall back to /api/internal/ai/generate, which itself
 *      tries Workers AI then Bedrock. Used for local dev or when the
 *      runner cannot hold CF creds.
 *
 * Required env:
 *   NOTION_API_KEY               Notion integration token
 *   NOTION_BLOG_DB_ID            Blog database id
 *
 * Path A (direct, preferred) — supply both:
 *   CLOUDFLARE_ACCOUNT_ID        Account id (currently inlined in deploy.yml)
 *   CLOUDFLARE_API_TOKEN         Token with Workers AI Read + Write
 *
 * Path B (route fallback) — supply both:
 *   AI_GENERATE_SECRET           Shared secret for /api/internal/ai/generate
 *   SITE_URL                     Base URL of the Lambda/pod hosting the route
 *
 *   SLACK_WEBHOOK_URL            (optional) pings the team on success
 *
 * Exit codes:
 *   0  draft created (or Slack-pinged failure that we want to surface)
 *   1  hard failure (config error, Anthropic/Notion API down, bad JSON)
 *
 * Quality gates (Layer 1 + Layer 2 — see scripts/article-quality-gates.ts):
 *   After generation we run deterministic gates (word count, structure,
 *   slug uniqueness, banned phrases, title novelty, forbidden topics) and
 *   an LLM critic (Cloudflare llama-3.1-8b). If ALL gates pass AND the
 *   critic verdict is "pass" with overall ≥ 7.0, the draft is inserted as
 *   Status="In Review" — this is the auto-promote path; the Monday 09:00
 *   UTC publisher cron sends it without any human touch. Otherwise the
 *   draft is inserted as Status="Draft" and the operator is DM'd with the
 *   exact reasons + critic feedback.
 */

import { runGates, type AutoPromoteVerdict } from "./article-quality-gates";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const SITE_URL_DEFAULT = "https://cloudless.gr";
/** Cloudflare Workers AI model. Route will fall back to llama-3-70b and then
 *  Bedrock Claude 3.5 Haiku if this model errors or is rate-limited. */
const CF_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export const CATEGORIES = ["Cloud", "Serverless", "Analytics", "AI Marketing"] as const;
export type Category = (typeof CATEGORIES)[number];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[generate-weekly-article] missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

export interface RecentPost {
  title: string;
  category: Category;
  /** ISO date the publisher set, falls back to created_time */
  date: string;
  slug: string;
}

async function notionFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = requireEnv("NOTION_API_KEY");
  return fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

/**
 * Pull the 12 most-recent posts (Published or otherwise) for two purposes:
 *   1. compute LRU category
 *   2. send recent titles to Claude so it doesn't repeat topics
 *
 * "Recently used" = max(Date, PublishedAt, created_time).
 */
async function fetchRecentPosts(): Promise<RecentPost[]> {
  const dbId = requireEnv("NOTION_BLOG_DB_ID");
  const res = await notionFetch(`/databases/${dbId}/query`, {
    method: "POST",
    body: JSON.stringify({
      page_size: 12,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Notion query failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const data = (await res.json()) as { results: NotionPage[] };
  return data.results.map((page) => {
    const p = page.properties ?? {};
    const title = (p.Title?.title ?? p.Name?.title ?? []).map((t) => t.plain_text ?? "").join("");
    const cat = (p.Category?.select?.name ?? "Cloud") as Category;
    const date = p.PublishedAt?.date?.start ?? p.Date?.date?.start ?? page.created_time ?? "";
    const slug = (p.Slug?.rich_text ?? []).map((t) => t.plain_text ?? "").join("");
    return { title, category: cat, date, slug };
  });
}

/**
 * Pick the category that hasn't been used in the longest time.
 * If a category is missing from recent posts entirely, it wins outright.
 */
export function pickLruCategory(recent: RecentPost[]): Category {
  const lastSeen = new Map<Category, string>();
  for (const post of recent) {
    const prev = lastSeen.get(post.category);
    if (!prev || post.date > prev) lastSeen.set(post.category, post.date);
  }
  for (const cat of CATEGORIES) {
    if (!lastSeen.has(cat)) return cat;
  }
  return [...CATEGORIES].sort((a, b) =>
    (lastSeen.get(a) ?? "").localeCompare(lastSeen.get(b) ?? "")
  )[0];
}

interface GeneratedArticle {
  title: string;
  slug: string;
  excerpt: string;
  readTime: string;
  /** Markdown body — no front-matter, no title (title is in `title`). */
  content: string;
}

/**
 * Brand-voice system prompt. Cached because it's identical every week —
 * `cache_control: ephemeral` lets Anthropic cache it for ~5 min, but the
 * weekly cadence means each run is a cold cache. The flag is harmless and
 * future-proofs against same-day reruns.
 */
const SYSTEM_PROMPT = `You are the senior content editor at Cloudless, a cloud consulting and AI marketing firm based in Greece serving startups and SMBs across the EU.

Brand voice:
- Direct and practical. No buzzword soup. No hedging.
- Written for technical decision-makers (startup CTOs, founders, SMB owners) — assume they're busy and skeptical of hype.
- Specific over abstract. Real numbers, real trade-offs, named tools and services.
- Greek-EU sensibility — GDPR, EU regions (eu-central-1, eu-west-1) over US-defaults.

Article structure:
- 800–1200 words.
- 4–6 H2 sections (## headings).
- Open with the problem, not a generic intro.
- Close with a concrete next step the reader can take this week.

Output format — strict JSON, no prose, no markdown fences. EVERY field
is a STRING (not an array, not an object). The "content" field is ONE
long string holding the full markdown body, with embedded \\n newlines
between paragraphs and headings. Never a list of sections.

Worked example (use this exact shape, your own topic):
{
  "title": "Cutting AWS Lambda Cold Starts: A Production Playbook",
  "slug": "aws-lambda-cold-starts-playbook",
  "excerpt": "How we trimmed p99 invocation latency by 78% across three Lambda services using provisioned concurrency, ARM, and SnapStart — with the numbers.",
  "readTime": "9 min read",
  "content": "## The pattern that bit us in production\\nWe ran a serverless image resizer on Lambda for an EU media customer ...\\n\\n## SnapStart on Java 21 ...\\n\\n## The next step you can take this week\\n..."
}`;

function buildUserMessage(category: Category, avoidTitles: string[]): string {
  return [
    `Write this week's blog post for the **${category}** category.`,
    "",
    "Recent posts (avoid repeating these topics):",
    avoidTitles.length ? avoidTitles.map((t) => `- ${t}`).join("\n") : "- (none)",
    "",
    "Pick a fresh angle that hasn't been covered. Output the JSON object only.",
  ].join("\n");
}

/** Direct Cloudflare Workers AI REST call. Bypasses the cloudless.gr Worker
 *  (10s CPU limit on Free plan) so a 4096-token 70B generation can finish. */
async function generateViaCloudflare(
  accountId: string,
  apiToken: string,
  category: Category,
  avoidTitles: string[]
): Promise<{ text: string; model: string }> {
  // Force schema-valid JSON. Without this, llama-3.3-70b will sometimes
  // emit `"content": [## Heading\nbody...]` — an array with unquoted
  // markdown — which JSON.parse rejects. The strict schema makes the
  // model server-side-validate before returning.
  const articleSchema = {
    type: "object",
    properties: {
      title: { type: "string" },
      slug: { type: "string" },
      excerpt: { type: "string" },
      readTime: { type: "string" },
      content: { type: "string" },
    },
    required: ["title", "slug", "excerpt", "readTime", "content"],
    additionalProperties: false,
  } as const;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CF_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(category, avoidTitles) },
        ],
        max_tokens: 4096,
        response_format: {
          type: "json_schema",
          json_schema: { name: "article", schema: articleSchema, strict: true },
        },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(
      `Cloudflare Workers AI failed: ${res.status} ${await res.text().catch(() => "")}`
    );
  }
  const data = (await res.json()) as {
    result?: { response?: unknown };
    errors?: { message?: string }[];
    success?: boolean;
  };
  if (!data.success) {
    throw new Error(
      `Cloudflare Workers AI rejected the request: ${data.errors?.[0]?.message ?? "unknown"}`
    );
  }
  const raw = data.result?.response;
  const text = typeof raw === "string" ? raw : raw == null ? "" : JSON.stringify(raw);
  return { text, model: CF_MODEL };
}

/** Fallback: call our own /api/internal/ai/generate route. Used for local dev
 *  and any environment where CF creds can't be held by the cron runner. */
async function generateViaRoute(
  category: Category,
  avoidTitles: string[]
): Promise<{ text: string; model: string; source: string }> {
  const secret = requireEnv("AI_GENERATE_SECRET");
  const siteUrl = (process.env.SITE_URL || SITE_URL_DEFAULT).replace(/\/$/, "");
  const res = await fetch(`${siteUrl}/api/internal/ai/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify({
      model: CF_MODEL,
      maxTokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(category, avoidTitles) }],
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Internal AI generation failed: ${res.status} ${await res.text().catch(() => "")}`
    );
  }
  const data = (await res.json()) as {
    result?: string;
    source?: "cloudflare" | "bedrock";
    model?: string;
  };
  return {
    text: data.result ?? "",
    model: data.model ?? "?",
    source: data.source ?? "unknown",
  };
}

/**
 * Robust JSON parser for model output.
 *
 * Tries strict JSON.parse first. On failure, attempts to extract the largest
 * balanced `{ ... }` block from the text and parse that — this rescues cases
 * where the model wraps the JSON in prose or appends a trailing explanation
 * despite the json_schema response_format. Throws with a truncated raw
 * payload on total failure so the GH Actions log stays readable.
 */
export function parseArticleJson(raw: string): GeneratedArticle {
  try {
    return JSON.parse(raw) as GeneratedArticle;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const candidate = raw.slice(start, end + 1);
      try {
        return JSON.parse(candidate) as GeneratedArticle;
      } catch (err2) {
        throw new Error(
          `Could not parse article JSON (after extraction). Raw: ${candidate.slice(0, 500)}`,
          { cause: err2 }
        );
      }
    }
    throw new Error(`Could not parse article JSON. Raw: ${raw.slice(0, 500)}`);
  }
}

async function generateArticle(
  category: Category,
  avoidTitles: string[]
): Promise<GeneratedArticle> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  let text: string;
  if (accountId && apiToken) {
    const r = await generateViaCloudflare(accountId, apiToken, category, avoidTitles);
    text = r.text;
    console.log(`[generate-weekly-article] generated via cloudflare-direct (${r.model})`);
  } else {
    const r = await generateViaRoute(category, avoidTitles);
    text = r.text;
    console.log(`[generate-weekly-article] generated via ${r.source} (${r.model})`);
  }

  // Strip ```json fences if the model adds them despite instructions.
  const cleaned = text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  const parsed = parseArticleJson(cleaned);

  const record = parsed as unknown as Record<string, unknown>;
  // Some endpoints return `content` as an array of paragraphs or block
  // objects (`{type, text}`). Join, don't crash.
  if (Array.isArray(record.content)) {
    record.content = (record.content as unknown[])
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          return typeof obj.text === "string" ? obj.text : JSON.stringify(obj);
        }
        return String(item ?? "");
      })
      .join("\n\n");
  }

  for (const key of ["title", "slug", "excerpt", "readTime", "content"]) {
    const v = record[key];
    if (typeof v !== "string" || !v.trim()) {
      throw new Error(`Generated article missing field: ${key}`);
    }
  }
  parsed.slug = parsed.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return parsed;
}

/**
 * Convert markdown into a flat list of Notion blocks.
 * Handles: H1/H2/H3, paragraphs, bullet/numbered lists. Anything more exotic
 * collapses to a paragraph — fine for AI-generated articles which we keep
 * to a constrained set.
 */
export function markdownToNotionBlocks(md: string): NotionBlock[] {
  const blocks: NotionBlock[] = [];
  const lines = md.split(/\r?\n/);
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) blocks.push(paragraphBlock(text));
    paragraph = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushParagraph();
      blocks.push(headingBlock(h[1].length as 1 | 2 | 3, h[2].trim()));
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      blocks.push(bulletBlock(bullet[1].trim()));
      continue;
    }
    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    if (numbered) {
      flushParagraph();
      blocks.push(numberedBlock(numbered[1].trim()));
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  return blocks;
}

function paragraphBlock(text: string): NotionBlock {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}
function headingBlock(level: 1 | 2 | 3, text: string): NotionBlock {
  const type = `heading_${level}` as const;
  return {
    object: "block",
    type,
    [type]: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}
function bulletBlock(text: string): NotionBlock {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}
function numberedBlock(text: string): NotionBlock {
  return {
    object: "block",
    type: "numbered_list_item",
    numbered_list_item: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

async function createDraftPage(
  article: GeneratedArticle,
  category: Category,
  initialStatus: "Draft" | "In Review" = "Draft"
): Promise<{ id: string; url: string }> {
  const dbId = requireEnv("NOTION_BLOG_DB_ID");
  const blocks = markdownToNotionBlocks(article.content);

  // Notion caps children at 100 per request — split if needed.
  const initialChildren = blocks.slice(0, 100);
  const remainingChildren = blocks.slice(100);

  const createRes = await notionFetch("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties: {
        Title: { title: [{ text: { content: article.title } }] },
        Slug: { rich_text: [{ text: { content: article.slug } }] },
        Excerpt: { rich_text: [{ text: { content: article.excerpt } }] },
        Category: { select: { name: category } },
        Status: { select: { name: initialStatus } },
        // Notion DB schema notes (verified 2026-06-14):
        //   - "Read Time" has a space; the script previously wrote `ReadTime`.
        //   - "Author" is a People property — cannot be set to a string from
        //     an integration token, so leave it empty for the human reviewer.
        //   - There is no `GeneratedBy` property in the DB.
        "Read Time": { rich_text: [{ text: { content: article.readTime } }] },
        Published: { checkbox: false },
      },
      children: initialChildren,
    }),
  });

  if (!createRes.ok) {
    throw new Error(
      `Notion create failed: ${createRes.status} ${await createRes.text().catch(() => "")}`
    );
  }
  const created = (await createRes.json()) as { id: string; url: string };

  if (remainingChildren.length) {
    // Append in chunks of 100 — should never exceed 200 for an 800-1200 word article.
    for (let i = 0; i < remainingChildren.length; i += 100) {
      const chunk = remainingChildren.slice(i, i + 100);
      const appendRes = await notionFetch(`/blocks/${created.id}/children`, {
        method: "PATCH",
        body: JSON.stringify({ children: chunk }),
      });
      if (!appendRes.ok) {
        console.warn(`[generate-weekly-article] block append failed: ${appendRes.status}`);
      }
    }
  }
  return created;
}

/**
 * Direct-message the operator (bot DM). Best path for "needs your eyes"
 * notifications — bypasses #newsletter noise. Requires SLACK_BOT_TOKEN and
 * SLACK_OPS_USER_ID; both must be set in the cron secrets. Falls back to a
 * regular slackPing if either is missing.
 */
async function slackDM(text: string): Promise<void> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const userId = process.env.SLACK_OPS_USER_ID;
  if (!botToken || !userId) {
    await slackPing(text);
    return;
  }
  try {
    // conversations.open is idempotent — returns the existing DM channel id.
    const open = await fetch("https://slack.com/api/conversations.open", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ users: userId }),
    });
    const openData = (await open.json().catch(() => ({}))) as {
      ok?: boolean;
      channel?: { id?: string };
      error?: string;
    };
    const dmCh = openData.channel?.id;
    if (!openData.ok || !dmCh) {
      console.warn(
        `[generate-weekly-article] conversations.open failed (${openData.error}), falling back to channel ping`
      );
      await slackPing(text);
      return;
    }
    const r = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel: dmCh, text }),
    });
    const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (data.ok) {
      console.log("[generate-weekly-article] DM sent to operator");
      return;
    }
    console.warn(
      `[generate-weekly-article] DM rejected (${data.error}), falling back to channel ping`
    );
    await slackPing(text);
  } catch (err) {
    console.warn("[generate-weekly-article] DM failed, falling back to channel ping:", err);
    await slackPing(text);
  }
}

async function slackPing(text: string): Promise<void> {
  // Prefer the bot-token path when both NEWSLETTER_SLACK_CHANNEL_ID and
  // SLACK_BOT_TOKEN are set — keeps editorial pings scoped to #newsletter
  // instead of fanning out via the generic incoming webhook.
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
          `[generate-weekly-article] Slack ping posted to ${channelId} via chat.postMessage`
        );
        return;
      }
      console.warn(
        `[generate-weekly-article] chat.postMessage rejected (${data.error}), falling back to webhook`
      );
    } catch (err) {
      console.warn(
        "[generate-weekly-article] chat.postMessage failed, falling back to webhook:",
        err
      );
    }
  }
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.warn(
      "[generate-weekly-article] no Slack destination configured " +
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
    console.log("[generate-weekly-article] Slack ping posted via SLACK_WEBHOOK_URL");
  } catch (err) {
    console.warn("[generate-weekly-article] Slack ping failed:", err);
  }
}

function formatVerdict(verdict: AutoPromoteVerdict): string {
  const lines: string[] = [];
  lines.push("*Layer 1 — deterministic gates*");
  for (const g of verdict.gates) {
    const tick = g.pass ? ":white_check_mark:" : ":x:";
    lines.push(`  ${tick} \`${g.name}\` — ${g.detail ?? ""}`);
  }
  if ("critic" in verdict && verdict.critic) {
    const c = verdict.critic;
    lines.push("");
    lines.push("*Layer 2 — LLM critic*");
    lines.push(`  overall: *${c.overall.toFixed(1)}/10* · verdict: \`${c.verdict}\``);
    lines.push(
      `  scores: factual=${c.scores.factual_credibility}, voice=${c.scores.brand_voice}, structure=${c.scores.structure}, originality=${c.scores.originality}, tech=${c.scores.technical_accuracy}`
    );
    if (c.issues.length > 0) {
      lines.push(
        `  issues: ${c.issues
          .slice(0, 5)
          .map((i) => `_${i}_`)
          .join("; ")}`
      );
    }
  }
  if (!verdict.promote && verdict.reason === "critic_unavailable") {
    lines.push("");
    lines.push("*Layer 2 — LLM critic*");
    lines.push(`  :warning: skipped (${verdict.criticError ?? "credentials missing"})`);
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  console.log("[generate-weekly-article] starting");
  const recent = await fetchRecentPosts();
  const category = pickLruCategory(recent);
  const avoidTitles = recent.slice(0, 8).map((p) => p.title);
  const existingSlugs = recent.map((p) => p.slug).filter(Boolean);
  console.log(
    `[generate-weekly-article] picked category=${category}; avoiding ${avoidTitles.length} recent titles`
  );

  const article = await generateArticle(category, avoidTitles);
  console.log(`[generate-weekly-article] generated: "${article.title}" (${article.slug})`);

  // Run quality gates BEFORE creating the Notion page so we know which
  // Status to insert with. This avoids needing a second PATCH after-create.
  console.log("[generate-weekly-article] running quality gates...");
  const verdict = await runGates({
    draft: {
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      readTime: article.readTime,
      content: article.content,
    },
    recentTitles: avoidTitles,
    existingSlugs,
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
  });

  const initialStatus = verdict.promote ? "In Review" : "Draft";
  console.log(
    `[generate-weekly-article] gates verdict: ${verdict.promote ? "AUTO-PROMOTE" : `HOLD (${verdict.reason})`} — Notion Status will be "${initialStatus}"`
  );

  const page = await createDraftPage(article, category, initialStatus);
  console.log(`[generate-weekly-article] page created: ${page.url}`);

  // Channel ping (visible to everyone in #newsletter)
  const headline = verdict.promote
    ? `:rocket: *AUTO-PROMOTED* — Weekly draft passed all gates, will publish + send Mon 09:00 UTC.`
    : `:eyes: *NEEDS REVIEW* — Weekly draft created but did NOT auto-pass quality gates.`;
  const channelMsg = `${headline}\n\n*${article.title}* — ${category} · ${article.readTime}\n${page.url}`;
  await slackPing(channelMsg);

  // Direct DM the operator the full verdict so the channel stays tidy.
  const dmBody = [
    headline,
    "",
    `*${article.title}*`,
    `_${article.excerpt}_`,
    `${category} · ${article.readTime} · slug \`${article.slug}\``,
    page.url,
    "",
    formatVerdict(verdict),
    "",
    verdict.promote
      ? ":information_source: No action needed. To cancel, flip Notion Status to `Archived` before Mon 09:00 UTC, or run `/cloudless-newsletter unpublish " +
        article.slug +
        "` after send."
      : ":pencil2: To approve manually: open the Notion page, edit if needed, flip Status to `In Review`. The publisher will pick it up on Mon 09:00 UTC OR you can run `/cloudless-newsletter send " +
        article.slug +
        "` to send immediately.",
  ].join("\n");
  await slackDM(dmBody);
}

// Only auto-run when invoked directly (skip during vitest imports).
if (process.argv[1]?.includes("generate-weekly-article")) {
  main().catch(async (err) => {
    console.error("[generate-weekly-article] FAILED:", err);
    await slackPing(
      `:warning: Weekly article generator FAILED: \`${String((err as Error)?.message ?? err).slice(
        0,
        500
      )}\``
    );
    process.exit(1);
  });
}

// ── Notion shape declarations (kept inline so the script stays self-contained) ──

interface NotionRichText {
  plain_text?: string;
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
  // Allow indexing for "Name" fallback
  [key: string]: unknown;
}
type NotionBlock = Record<string, unknown>;
