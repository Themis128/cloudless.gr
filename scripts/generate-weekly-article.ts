/**
 * Weekly Article Generator
 *
 * Picks the least-recently-used Category from the Notion Blog database,
 * asks Claude to author a fresh article in that category (avoiding topic
 * repetition with recent posts), and inserts the result as a Draft for
 * human review. Slack-pings the editor with a link.
 *
 * Designed to run from .github/workflows/weekly-article-draft.yml on
 * Monday 06:00 UTC. Self-contained — reads env directly, talks to Notion
 * and Anthropic via raw fetch (no src/lib/* imports, no SSM, no @/ alias).
 *
 * Required env:
 *   ANTHROPIC_API_KEY            Claude API key
 *   NOTION_API_KEY               Notion integration token
 *   NOTION_BLOG_DB_ID            Blog database id
 *   SLACK_WEBHOOK_URL            (optional) pings the team on success
 *
 * Exit codes:
 *   0  draft created (or Slack-pinged failure that we want to surface)
 *   1  hard failure (config error, Anthropic/Notion API down, bad JSON)
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";

const CATEGORIES = [
  "Cloud",
  "Serverless",
  "Analytics",
  "AI Marketing",
] as const;
type Category = (typeof CATEGORIES)[number];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[generate-weekly-article] missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

interface RecentPost {
  title: string;
  category: Category;
  /** ISO date the publisher set, falls back to created_time */
  date: string;
}

async function notionFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
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
    throw new Error(
      `Notion query failed: ${res.status} ${await res.text().catch(() => "")}`,
    );
  }
  const data = (await res.json()) as { results: NotionPage[] };
  return data.results.map((page) => {
    const p = page.properties ?? {};
    const title = (p.Title?.title ?? p.Name?.title ?? [])
      .map((t) => t.plain_text ?? "")
      .join("");
    const cat = (p.Category?.select?.name ?? "Cloud") as Category;
    const date =
      p.PublishedAt?.date?.start ??
      p.Date?.date?.start ??
      page.created_time ??
      "";
    return { title, category: cat, date };
  });
}

/**
 * Pick the category that hasn't been used in the longest time.
 * If a category is missing from recent posts entirely, it wins outright.
 */
function pickLruCategory(recent: RecentPost[]): Category {
  const lastSeen = new Map<Category, string>();
  for (const post of recent) {
    const prev = lastSeen.get(post.category);
    if (!prev || post.date > prev) lastSeen.set(post.category, post.date);
  }
  for (const cat of CATEGORIES) {
    if (!lastSeen.has(cat)) return cat;
  }
  return [...CATEGORIES].sort(
    (a, b) => (lastSeen.get(a) ?? "").localeCompare(lastSeen.get(b) ?? ""),
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

Output format — strict JSON, no prose, no markdown fences:
{
  "title": "...",                  // 50–70 chars, specific, no clickbait
  "slug": "...",                   // kebab-case, lowercase, 3–6 words
  "excerpt": "...",                // ONE sentence, 120–180 chars, used in newsletter preview
  "readTime": "X min read",        // estimate at ~200 words/min
  "content": "..."                 // markdown body, NO front-matter, NO title heading
}`;

async function generateArticle(
  category: Category,
  avoidTitles: string[],
): Promise<GeneratedArticle> {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");

  const userMessage = [
    `Write this week's blog post for the **${category}** category.`,
    "",
    "Recent posts (avoid repeating these topics):",
    avoidTitles.length
      ? avoidTitles.map((t) => `- ${t}`).join("\n")
      : "- (none)",
    "",
    "Pick a fresh angle that hasn't been covered. Output the JSON object only.",
  ].join("\n");

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Anthropic API failed: ${res.status} ${await res.text().catch(() => "")}`,
    );
  }
  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const text = data.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!)
    .join("");

  // Strip ```json fences if the model adds them despite instructions.
  const cleaned = text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  let parsed: GeneratedArticle;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Could not parse article JSON. Raw: ${cleaned.slice(0, 500)}`,
      { cause: err },
    );
  }

  const record = parsed as unknown as Record<string, unknown>;
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
function markdownToNotionBlocks(md: string): NotionBlock[] {
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
        Status: { select: { name: "Draft" } },
        GeneratedBy: { select: { name: "AI" } },
        ReadTime: { rich_text: [{ text: { content: article.readTime } }] },
        Author: { rich_text: [{ text: { content: "Cloudless Team" } }] },
        Published: { checkbox: false },
      },
      children: initialChildren,
    }),
  });

  if (!createRes.ok) {
    throw new Error(
      `Notion create failed: ${createRes.status} ${await createRes
        .text()
        .catch(() => "")}`,
    );
  }
  const created = (await createRes.json()) as { id: string; url: string };

  if (remainingChildren.length) {
    // Append in chunks of 100 — should never exceed 200 for an 800-1200 word article.
    for (let i = 0; i < remainingChildren.length; i += 100) {
      const chunk = remainingChildren.slice(i, i + 100);
      const appendRes = await notionFetch(
        `/blocks/${created.id}/children`,
        { method: "PATCH", body: JSON.stringify({ children: chunk }) },
      );
      if (!appendRes.ok) {
        console.warn(
          `[generate-weekly-article] block append failed: ${appendRes.status}`,
        );
      }
    }
  }
  return created;
}

async function slackPing(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.warn("[generate-weekly-article] Slack ping failed:", err);
  }
}

async function main(): Promise<void> {
  console.log("[generate-weekly-article] starting");
  const recent = await fetchRecentPosts();
  const category = pickLruCategory(recent);
  const avoidTitles = recent.slice(0, 8).map((p) => p.title);
  console.log(
    `[generate-weekly-article] picked category=${category}; avoiding ${avoidTitles.length} recent titles`,
  );

  const article = await generateArticle(category, avoidTitles);
  console.log(
    `[generate-weekly-article] generated: "${article.title}" (${article.slug})`,
  );

  const page = await createDraftPage(article, category);
  console.log(`[generate-weekly-article] draft created: ${page.url}`);

  await slackPing(
    `:newspaper: Weekly draft ready for review (${category}): *${article.title}*\n${page.url}\n\nApprove in Notion before Mon 09:00 UTC to publish + send newsletter.`,
  );
}

main().catch(async (err) => {
  console.error("[generate-weekly-article] FAILED:", err);
  await slackPing(
    `:warning: Weekly article generator FAILED: \`${String(
      (err as Error)?.message ?? err,
    ).slice(0, 500)}\``,
  );
  process.exit(1);
});

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
