/**
 * Notion Blog CMS — fetches blog posts from the Notion Blog Posts database.
 *
 * Uses the shared Notion API client and renders rich content via blocksToHtml().
 * Falls back gracefully when Notion is not configured.
 *
 * Expected Notion database schema (NOTION_BLOG_DB_ID):
 * ┌────────────────┬─────────────────────────────────────────────────┐
 * │ Column         │ Type                                            │
 * ├────────────────┼─────────────────────────────────────────────────┤
 * │ Title          │ Title                                           │
 * │ Slug           │ Rich text (URL-safe)                            │
 * │ Excerpt        │ Rich text                                       │
 * │ Date           │ Date                                            │
 * │ Author         │ Rich text                                       │
 * │ Category       │ Select                                          │
 * │ Tags           │ Multi-select                                    │
 * │ Published      │ Checkbox                                        │
 * │ Featured       │ Checkbox                                        │
 * │ Cover Image    │ URL                                             │
 * │ Read Time      │ Rich text                                       │
 * │ SEO Title      │ Rich text (optional override)                   │
 * │ SEO Description│ Rich text (optional override)                   │
 * └────────────────┴─────────────────────────────────────────────────┘
 */

import {
  notionFetchAll,
  notionListAll,
  extractText,
  blocksToHtml,
} from "@/lib/notion";
import { getIntegrationsAsync, isConfiguredAsync } from "@/lib/integrations";
import { cached } from "@/lib/notion-cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotionPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
  category: string;
  tags: string[];
  published: boolean;
  featured: boolean;
  coverImage?: string;
  readTime: string;
  seoTitle?: string;
  seoDescription?: string;
}

export type NotionBlock = Record<string, unknown>;

export interface NotionPostWithContent extends NotionPost {
  html: string;
  content: NotionBlock[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapPage(page: any): NotionPost {
  const p = page.properties ?? {};
  return {
    id: page.id,
    slug: extractText(p.Slug?.rich_text) || page.id,
    title: extractText((p.Title ?? p.Name)?.title),
    excerpt: extractText(p.Excerpt?.rich_text),
    date: p.Date?.date?.start ?? page.created_time ?? "",
    author:
      (p.Author?.people ?? []).map((u: any) => u.name ?? "").join(", ") ||
      extractText(p.Author?.rich_text) ||
      "Cloudless Team",
    category: p.Category?.select?.name ?? "General",
    tags: (p.Tags?.multi_select ?? []).map((t: any) => t.name),
    published: p.Published?.checkbox ?? false,
    featured: p.Featured?.checkbox ?? false,
    coverImage:
      p["Cover Image"]?.url ??
      page.cover?.external?.url ??
      page.cover?.file?.url,
    readTime: extractText(p["Read Time"]?.rich_text) || "5 min read",
    seoTitle: extractText(p["SEO Title"]?.rich_text) || undefined,
    seoDescription: extractText(p["SEO Description"]?.rich_text) || undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all published blog posts, sorted by date descending.
 * Returns empty array when Notion is not configured.
 */
export async function getPosts(): Promise<NotionPost[]> {
  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_BLOG_DB_ID")))
    return [];

  return cached("blog:posts", async () => {
    const { NOTION_BLOG_DB_ID } = await getIntegrationsAsync();
    try {
      const pages = await notionFetchAll(
        `/databases/${NOTION_BLOG_DB_ID}/query`,
        {
          filter: { property: "Published", checkbox: { equals: true } },
          sorts: [{ property: "Date", direction: "descending" }],
        },
      );
      return pages.map(mapPage);
    } catch (err) {
      console.error("[Notion Blog] Failed to fetch posts:", err);
      return [];
    }
  });
}

/**
 * Fetch all posts (published and drafts) for admin use. Not cached.
 */
export async function getAllPosts(): Promise<NotionPost[]> {
  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_BLOG_DB_ID")))
    return [];

  const { NOTION_BLOG_DB_ID } = await getIntegrationsAsync();
  try {
    const pages = await notionFetchAll(
      `/databases/${NOTION_BLOG_DB_ID}/query`,
      { sorts: [{ property: "Date", direction: "descending" }] },
    );
    return pages.map(mapPage);
  } catch (err) {
    console.error("[Notion Blog] Failed to fetch all posts:", err);
    return [];
  }
}

/**
 * Fetch featured posts only (for homepage hero).
 */
export async function getFeaturedPosts(): Promise<NotionPost[]> {
  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_BLOG_DB_ID")))
    return [];

  const { NOTION_BLOG_DB_ID } = await getIntegrationsAsync();
  try {
    const pages = await notionFetchAll(
      `/databases/${NOTION_BLOG_DB_ID}/query`,
      {
        filter: {
          and: [
            { property: "Published", checkbox: { equals: true } },
            { property: "Featured", checkbox: { equals: true } },
          ],
        },
        sorts: [{ property: "Date", direction: "descending" }],
      },
    );
    return pages.map(mapPage);
  } catch (err) {
    console.error("[Notion Blog] Failed to fetch featured posts:", err);
    return [];
  }
}

/**
 * Fetch posts filtered by category.
 */
export async function getPostsByCategory(
  category: string,
): Promise<NotionPost[]> {
  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_BLOG_DB_ID")))
    return [];

  const { NOTION_BLOG_DB_ID } = await getIntegrationsAsync();
  try {
    const pages = await notionFetchAll(
      `/databases/${NOTION_BLOG_DB_ID}/query`,
      {
        filter: {
          and: [
            { property: "Published", checkbox: { equals: true } },
            { property: "Category", select: { equals: category } },
          ],
        },
        sorts: [{ property: "Date", direction: "descending" }],
      },
    );
    return pages.map(mapPage);
  } catch (err) {
    console.error("[Notion Blog] Failed to fetch posts by category:", err);
    return [];
  }
}

/**
 * Fetch posts filtered by tag.
 */
export async function getPostsByTag(tag: string): Promise<NotionPost[]> {
  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_BLOG_DB_ID")))
    return [];

  const { NOTION_BLOG_DB_ID } = await getIntegrationsAsync();
  try {
    const pages = await notionFetchAll(
      `/databases/${NOTION_BLOG_DB_ID}/query`,
      {
        filter: {
          and: [
            { property: "Published", checkbox: { equals: true } },
            { property: "Tags", multi_select: { contains: tag } },
          ],
        },
        sorts: [{ property: "Date", direction: "descending" }],
      },
    );
    return pages.map(mapPage);
  } catch (err) {
    console.error("[Notion Blog] Failed to fetch posts by tag:", err);
    return [];
  }
}

/**
 * Fetch a single post by slug, including full rendered HTML content.
 */
export async function getPostBySlug(
  slug: string,
): Promise<NotionPostWithContent | null> {
  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_BLOG_DB_ID")))
    return null;

  const { NOTION_BLOG_DB_ID } = await getIntegrationsAsync();
  try {
    const pages = await notionFetchAll(
      `/databases/${NOTION_BLOG_DB_ID}/query`,
      {
        filter: {
          and: [
            { property: "Slug", rich_text: { equals: slug } },
            { property: "Published", checkbox: { equals: true } },
          ],
        },
      },
    );

    const page = pages[0];
    if (!page) return null;

    const post = mapPage(page);

    // Fetch block content (GET endpoint — use notionListAll)
    const blocks = await notionListAll(`/blocks/${post.id}/children`);
    const html = blocksToHtml(blocks);

    return { ...post, html, content: blocks as NotionBlock[] };
  } catch (err) {
    console.error("[Notion Blog] Failed to fetch post by slug:", err);
    return null;
  }
}

/**
 * Get all published slugs (for sitemap / static generation).
 */
export async function getAllSlugs(): Promise<string[]> {
  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_BLOG_DB_ID")))
    return [];

  const { NOTION_BLOG_DB_ID } = await getIntegrationsAsync();
  try {
    const pages = await notionFetchAll(
      `/databases/${NOTION_BLOG_DB_ID}/query`,
      {
        filter: { property: "Published", checkbox: { equals: true } },
      },
    );
    return pages.map((p) => mapPage(p).slug).filter(Boolean);
  } catch (err) {
    console.error("[Notion Blog] Failed to fetch slugs:", err);
    return [];
  }
}

/**
 * Get all unique categories from published posts.
 */
export async function getCategories(): Promise<string[]> {
  const posts = await getPosts();
  return [...new Set(posts.map((p) => p.category))];
}

/**
 * Get all unique tags from published posts.
 */
export async function getTags(): Promise<string[]> {
  const posts = await getPosts();
  return [...new Set(posts.flatMap((p) => p.tags))];
}

// ---------------------------------------------------------------------------
// Enhanced features (from Academy skills)
// ---------------------------------------------------------------------------

/**
 * Search blog posts by title or excerpt (client-side filter).
 * For full-text search, use the Notion Search API via notion-search.ts.
 */
export async function searchPosts(query: string): Promise<NotionPost[]> {
  if (!query.trim()) return [];
  const posts = await getPosts();
  const q = query.toLowerCase();
  return posts.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

/**
 * Get related posts based on shared tags and category.
 * Returns up to `limit` posts, excluding the current post.
 */
export async function getRelatedPosts(
  post: NotionPost,
  limit = 3,
): Promise<NotionPost[]> {
  const allPosts = await getPosts();
  const others = allPosts.filter((p) => p.id !== post.id);

  // Score each post by relevance: same category = 2pts, each shared tag = 1pt
  const scored = others.map((p) => {
    let score = 0;
    if (p.category === post.category) score += 2;
    for (const tag of p.tags) {
      if (post.tags.includes(tag)) score += 1;
    }
    return { post: p, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.post);
}

/**
 * Get a post with full content AND a table of contents.
 * Uses extractToc from the shared client.
 */
export async function getPostWithToc(
  slug: string,
): Promise<
  (NotionPostWithContent & { toc: import("@/lib/notion").TocEntry[] }) | null
> {
  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_BLOG_DB_ID")))
    return null;

  const { NOTION_BLOG_DB_ID } = await getIntegrationsAsync();
  try {
    const pages = await notionFetchAll(
      `/databases/${NOTION_BLOG_DB_ID}/query`,
      {
        filter: {
          and: [
            { property: "Slug", rich_text: { equals: slug } },
            { property: "Published", checkbox: { equals: true } },
          ],
        },
      },
    );

    const page = pages[0];
    if (!page) return null;

    const post = mapPage(page);
    const blocks = await notionListAll(`/blocks/${post.id}/children`);
    const html = blocksToHtml(blocks);

    // Import extractToc at runtime to avoid circular deps
    const { extractToc } = await import("@/lib/notion");
    const toc = extractToc(blocks as Parameters<typeof extractToc>[0]);

    return { ...post, html, toc, content: blocks as NotionBlock[] };
  } catch (err) {
    console.error("[Notion Blog] Failed to fetch post with TOC:", err);
    return null;
  }
}

/**
 * Get posts count by category (for sidebar widgets).
 */
export async function getCategoryCounts(): Promise<Record<string, number>> {
  const posts = await getPosts();
  const counts: Record<string, number> = {};
  for (const p of posts) {
    counts[p.category] = (counts[p.category] ?? 0) + 1;
  }
  return counts;
}

/**
 * Get posts count by tag (for tag cloud).
 */
export async function getTagCounts(): Promise<Record<string, number>> {
  const posts = await getPosts();
  const counts: Record<string, number> = {};
  for (const p of posts) {
    for (const tag of p.tags) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Get paginated posts for blog listing pages.
 */
export async function getPaginatedPosts(
  page: number,
  perPage = 10,
): Promise<{ posts: NotionPost[]; total: number; totalPages: number }> {
  const allPosts = await getPosts();
  const start = (page - 1) * perPage;
  const posts = allPosts.slice(start, start + perPage);
  return {
    posts,
    total: allPosts.length,
    totalPages: Math.ceil(allPosts.length / perPage),
  };
}
