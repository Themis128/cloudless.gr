import {
  posts as staticPosts,
  getPostBySlug as getStaticPostBySlug,
  type BlogPost,
} from "@/lib/blog";
import { isConfiguredAsync } from "@/lib/integrations";
import {
  getPosts as getAppFlowyPosts,
  getPostBySlug as getAppFlowyPostBySlug,
  type AppFlowyPost,
} from "@/lib/appflowy-blog";
import { isAppFlowyConfigured } from "@/lib/appflowy";
import {
  getPosts as getNotionPosts,
  getPostBySlug as getNotionPostBySlug,
  type NotionBlock,
  type NotionPost,
} from "@/lib/notion-blog";
import type { CmsSource } from "@/lib/cms-provider";

const DEFAULT_CATEGORY = "Cloud" as BlogPost["category"];
const WORDS_PER_MINUTE = 200;
/** Bound CMS lookups so unbound/unreachable Notion/AppFlowy cannot hang SSR. */
const CMS_LOOKUP_MS = 8_000;

async function withCmsTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), CMS_LOOKUP_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeCategory(tags: string[]): BlogPost["category"] {
  return (tags.find((tag) => tag.trim()) ?? DEFAULT_CATEGORY) as BlogPost["category"];
}

function estimateReadTime(text: string): string {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
  return `${minutes} min read`;
}

function getPayload(block: NotionBlock): Record<string, unknown> | undefined {
  const payload = block[block.type as string];
  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : undefined;
}

function extractPayloadText(payload?: Record<string, unknown>): string {
  if (!payload) return "";

  const richText = payload.rich_text;
  if (Array.isArray(richText)) {
    return richText
      .map((entry) =>
        typeof entry === "object" && entry !== null && "plain_text" in entry
          ? String(entry.plain_text ?? "")
          : ""
      )
      .join("");
  }

  const title = payload.title;
  if (Array.isArray(title)) {
    return title
      .map((entry) =>
        typeof entry === "object" && entry !== null && "plain_text" in entry
          ? String(entry.plain_text ?? "")
          : ""
      )
      .join("");
  }

  return "";
}

function blocksToContent(blocks: NotionBlock[]): string {
  const parts: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      parts.push(listItems.join("\n"));
      listItems = [];
    }
  };

  for (const block of blocks) {
    const payload = getPayload(block);
    const text = extractPayloadText(payload).trim();

    switch (block.type) {
      case "bulleted_list_item":
      case "numbered_list_item":
      case "to_do": {
        if (text) listItems.push(`- ${text}`);
        break;
      }
      case "heading_1":
      case "heading_2":
      case "heading_3": {
        flushList();
        if (text) parts.push(`## ${text}`);
        break;
      }
      case "paragraph":
      case "quote":
      case "callout":
      case "code": {
        flushList();
        if (text) parts.push(text);
        break;
      }
      default: {
        flushList();
        if (text) parts.push(text);
        break;
      }
    }
  }

  flushList();
  return parts.join("\n\n").trim();
}

function mapNotionListingPost(post: NotionPost): BlogPost {
  const readingSource = `${post.title} ${post.excerpt}`.trim();
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    date: post.date,
    readTime: estimateReadTime(readingSource),
    category: normalizeCategory(post.tags),
    content: "",
  };
}

function mapNotionPost(post: NotionPost & { content: NotionBlock[] }): BlogPost {
  const content = blocksToContent(post.content);
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    date: post.date,
    readTime: estimateReadTime(`${post.title} ${post.excerpt} ${content}`),
    category: normalizeCategory(post.tags),
    content,
  };
}

function mapAppFlowyListingPost(post: AppFlowyPost): BlogPost {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    date: post.date,
    readTime: post.readTime || "5 min read",
    category: (post.category || DEFAULT_CATEGORY) as BlogPost["category"],
    content: "",
  };
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapAppFlowyPost(post: AppFlowyPost): BlogPost {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    date: post.date,
    readTime: post.readTime || "5 min read",
    category: (post.category || DEFAULT_CATEGORY) as BlogPost["category"],
    content: stripHtml(post.html || ""),
  };
}

export async function getBlogPostsWithSource(): Promise<{
  posts: BlogPost[];
  source: CmsSource;
}> {
  if (await isAppFlowyConfigured()) {
    try {
      const appFlowyPosts = await withCmsTimeout(getAppFlowyPosts(), []);
      const published = appFlowyPosts.filter((post) => post.published);
      if (published.length > 0) {
        return {
          posts: published.map(mapAppFlowyListingPost),
          source: "appflowy",
        };
      }
    } catch {
      // Fall through to Notion/static provider chain.
    }
  }

  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_BLOG_DB_ID"))) {
    return { posts: staticPosts, source: "static" };
  }

  try {
    const notionPosts = await withCmsTimeout(getNotionPosts(), []);
    if (notionPosts.length > 0) {
      return { posts: notionPosts.map(mapNotionListingPost), source: "notion" };
    }
  } catch {
    // Fall through to static.
  }

  return { posts: staticPosts, source: "static" };
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  const { posts } = await getBlogPostsWithSource();
  return posts;
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
  // Instant path for built-in static posts (avoids CMS round-trip on known slugs).
  const staticHit = getStaticPostBySlug(slug);

  if (await isAppFlowyConfigured()) {
    try {
      const appFlowyPost = await withCmsTimeout(getAppFlowyPostBySlug(slug), null);
      if (appFlowyPost?.published) {
        return mapAppFlowyPost(appFlowyPost);
      }
    } catch {
      // Fall through to Notion/static provider chain.
    }
  }

  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_BLOG_DB_ID"))) {
    return staticHit;
  }

  try {
    const notionPost = await withCmsTimeout(getNotionPostBySlug(slug), null);
    if (notionPost) {
      return mapNotionPost(notionPost);
    }
  } catch {
    // Fall through to static.
  }

  return staticHit;
}
