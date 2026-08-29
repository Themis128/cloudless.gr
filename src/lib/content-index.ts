/**
 * AppFlowy → Meilisearch content indexer.
 *
 * Indexes published blog posts and docs from AppFlowy into the `site-content`
 * Meilisearch index so public site search works without hitting AppFlowy on
 * every request.
 *
 * Documents are upserted by stable primary key (`blog:<slug>` / `doc:<slug>`),
 * so incremental re-runs only update changed content; orphan entries (deleted
 * AppFlowy pages) persist until a full reindex replaces them.
 */

import {
  meiliRequest,
  getMeiliAdminKey,
  getMeiliSearchKey,
  isMeilisearchConfigured,
} from "@/lib/meilisearch";
import { getPosts } from "@/lib/appflowy-blog";
import { getDocs } from "@/lib/appflowy-docs";
import { isAppFlowyConfigured } from "@/lib/appflowy";

export const CONTENT_INDEX = "site-content";

export interface ContentDocument {
  id: string;
  type: "blog" | "doc";
  title: string;
  body: string;
  excerpt: string;
  url: string;
  category: string;
  date: string;
}

export interface ContentSearchResult {
  id: string;
  type: "blog" | "doc";
  title: string;
  excerpt: string;
  url: string;
  category: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toExcerpt(body: string, maxLen = 200): string {
  const trimmed = body.slice(0, maxLen).trim();
  return body.length > maxLen ? `${trimmed}…` : trimmed;
}

async function ensureContentIndex(): Promise<void> {
  try {
    await meiliRequest(`/indexes/${CONTENT_INDEX}`, { method: "GET" }, getMeiliAdminKey());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("404") && !msg.includes("index_not_found")) throw err;
    await meiliRequest(
      "/indexes",
      {
        method: "POST",
        body: JSON.stringify({ uid: CONTENT_INDEX, primaryKey: "id" }),
      },
      getMeiliAdminKey()
    );
  }

  await meiliRequest(
    `/indexes/${CONTENT_INDEX}/settings`,
    {
      method: "PATCH",
      body: JSON.stringify({
        filterableAttributes: ["type", "category"],
        sortableAttributes: ["date"],
        searchableAttributes: ["title", "excerpt", "body", "category"],
      }),
    },
    getMeiliAdminKey()
  );
}

export async function syncContentIndex(): Promise<{
  indexed: number;
  configured: boolean;
  sources: { blog: number; docs: number };
}> {
  const empty = { indexed: 0, configured: false, sources: { blog: 0, docs: 0 } };

  if (!isMeilisearchConfigured()) return empty;
  if (!(await isAppFlowyConfigured())) return empty;

  const [posts, docs] = await Promise.all([getPosts(), getDocs()]);

  const documents: ContentDocument[] = [
    ...posts
      .filter((p) => p.published)
      .map((p) => {
        const body = stripHtml(p.html || "");
        return {
          id: `blog:${p.slug}`,
          type: "blog" as const,
          title: p.title,
          body: body.slice(0, 5000),
          excerpt: p.excerpt || toExcerpt(body),
          url: `/blog/${p.slug}`,
          category: p.category || "Cloud",
          date: p.date,
        };
      }),
    ...docs
      .filter((d) => d.published)
      .map((d) => {
        const body = stripHtml(d.html || "");
        return {
          id: `doc:${d.slug}`,
          type: "doc" as const,
          title: d.title,
          body: body.slice(0, 5000),
          excerpt: d.description || toExcerpt(body),
          url: `/docs/${d.slug}`,
          category: d.category || "General",
          date: new Date().toISOString(),
        };
      }),
  ];

  if (documents.length === 0) {
    return { indexed: 0, configured: true, sources: { blog: 0, docs: 0 } };
  }

  await ensureContentIndex();

  await meiliRequest(
    `/indexes/${CONTENT_INDEX}/documents`,
    { method: "POST", body: JSON.stringify(documents) },
    getMeiliAdminKey()
  );

  const blogCount = documents.filter((d) => d.type === "blog").length;
  const docCount = documents.filter((d) => d.type === "doc").length;

  return {
    indexed: documents.length,
    configured: true,
    sources: { blog: blogCount, docs: docCount },
  };
}

export async function searchContent(
  query: string,
  limit = 8
): Promise<ContentSearchResult[]> {
  if (!isMeilisearchConfigured() || !query.trim()) return [];

  try {
    const result = await meiliRequest<{ hits: ContentDocument[] }>(
      `/indexes/${CONTENT_INDEX}/search`,
      {
        method: "POST",
        body: JSON.stringify({
          q: query,
          limit,
          attributesToRetrieve: ["id", "type", "title", "excerpt", "url", "category"],
        }),
      },
      getMeiliSearchKey()
    );
    return result.hits.map((h) => ({
      id: h.id,
      type: h.type,
      title: h.title,
      excerpt: h.excerpt,
      url: h.url,
      category: h.category,
    }));
  } catch {
    return [];
  }
}
