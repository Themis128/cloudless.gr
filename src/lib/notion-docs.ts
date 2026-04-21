/**
 * Notion internal docs library.
 *
 * Reads from the NOTION_DOCS_DB_ID database.
 *
 * Expected Notion database schema:
 * ┌──────────────┬──────────────────────────────┐
 * │ Column       │ Type                         │
 * ├──────────────┼──────────────────────────────┤
 * │ Title        │ Title                        │
 * │ Slug         │ Rich text                    │
 * │ Category     │ Select                       │
 * │ Description  │ Rich text                    │
 * │ Published    │ Checkbox                     │
 * │ Order        │ Number                       │
 * └──────────────┴──────────────────────────────┘
 *
 * All functions degrade gracefully to empty/null when Notion is not configured.
 */

import {
  notionFetch,
  notionFetchAll,
  notionListAll,
  blocksToHtml,
} from "@/lib/notion";
import { getIntegrationsAsync } from "@/lib/integrations";
import { cached } from "@/lib/notion-cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  order: number;
  published: boolean;
  url: string;
}

export interface DocContent extends DocRecord {
  /** Rendered HTML from Notion blocks */
  html: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapPage(page: any): DocRecord {
  const p = page.properties ?? {};
  return {
    id: page.id,
    slug:
      (p.Slug?.rich_text ?? []).map((t: any) => t.plain_text).join("") ||
      page.id,
    title: (p.Title?.title ?? []).map((t: any) => t.plain_text).join(""),
    description: (p.Description?.rich_text ?? [])
      .map((t: any) => t.plain_text)
      .join(""),
    category: p.Category?.select?.name ?? "General",
    order: p.Order?.number ?? 0,
    published: p.Published?.checkbox ?? false,
    url: page.url,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List all published docs, sorted by Category + Order.
 * Returns empty array if Notion is not configured.
 */
export async function getDocs(): Promise<DocRecord[]> {
  const { NOTION_API_KEY, NOTION_DOCS_DB_ID } = await getIntegrationsAsync();
  if (!NOTION_API_KEY || !NOTION_DOCS_DB_ID) return [];

  return cached("docs:all", async () => {
    try {
      const results = await notionFetchAll<unknown>(
        `/databases/${NOTION_DOCS_DB_ID}/query`,
        {
          filter: { property: "Published", checkbox: { equals: true } },
          sorts: [
            { property: "Category", direction: "ascending" },
            { property: "Order", direction: "ascending" },
          ],
        },
      );

      /* eslint-disable @typescript-eslint/no-explicit-any */
      return (results as any[]).map(mapPage);
      /* eslint-enable @typescript-eslint/no-explicit-any */
    } catch (err) {
      console.error("[Notion] Failed to fetch docs:", err);
      return [];
    }
  });
}

/**
 * Fetch a single doc by slug (published only).
 * Returns null if not found or Notion is not configured.
 */
export async function getDocBySlug(slug: string): Promise<DocRecord | null> {
  const { NOTION_API_KEY, NOTION_DOCS_DB_ID } = await getIntegrationsAsync();
  if (!NOTION_API_KEY || !NOTION_DOCS_DB_ID) return null;

  try {
    const data = await notionFetch<{ results: unknown[] }>(
      `/databases/${NOTION_DOCS_DB_ID}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          filter: {
            and: [
              { property: "Slug", rich_text: { equals: slug } },
              { property: "Published", checkbox: { equals: true } },
            ],
          },
          page_size: 1,
        }),
      },
    );

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const page = (data.results as any[])?.[0];
    /* eslint-enable @typescript-eslint/no-explicit-any */
    if (!page) return null;

    return mapPage(page);
  } catch (err) {
    console.error("[Notion] Failed to fetch doc by slug:", err);
    return null;
  }
}

/**
 * Fetch a doc's full content as rendered HTML.
 * Returns null if not found or Notion is not configured.
 */
export async function getDocContent(
  pageId: string,
): Promise<DocContent | null> {
  const { NOTION_API_KEY } = await getIntegrationsAsync();
  if (!NOTION_API_KEY) return null;

  try {
    // Fetch the page metadata
    const page = await notionFetch<unknown>(`/pages/${pageId}`);

    // Fetch all blocks (handles pagination via GET)
    const blocks = await notionListAll<unknown>(`/blocks/${pageId}/children`);

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const record = mapPage(page as any);
    const html = blocksToHtml(blocks as any[]);
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return { ...record, html };
  } catch (err) {
    console.error("[Notion] Failed to fetch doc content:", err);
    return null;
  }
}

/**
 * Group docs by category for sidebar navigation.
 */
export function groupDocsByCategory(
  docs: DocRecord[],
): Record<string, DocRecord[]> {
  return docs.reduce<Record<string, DocRecord[]>>((acc, doc) => {
    const cat = doc.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});
}

// ---------------------------------------------------------------------------
// Wiki features (from notion-wikis Academy skill)
// ---------------------------------------------------------------------------

export interface WikiDocRecord extends DocRecord {
  /** Verification status: Verified / Needs re-verification / Unverified */
  verificationStatus: string;
  /** Page owner (person responsible for keeping it accurate) */
  owner: string;
  /** Last verified date */
  lastVerified: string;
  /** Last edited date (auto) */
  lastEdited: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapWikiPage(page: any): WikiDocRecord {
  const base = mapPage(page);
  const p = page.properties ?? {};
  return {
    ...base,
    verificationStatus:
      p["Verification Status"]?.status?.name ??
      p["Verification Status"]?.select?.name ??
      "Unverified",
    owner:
      (p.Owner?.people ?? []).map((u: any) => u.name ?? "").join(", ") || "",
    lastVerified:
      p["Last verified"]?.date?.start ?? p["Last Verified"]?.date?.start ?? "",
    lastEdited: page.last_edited_time ?? "",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * List docs with wiki metadata (verification, ownership).
 * Falls back to regular docs if wiki properties don't exist.
 */
export async function getWikiDocs(): Promise<WikiDocRecord[]> {
  const { NOTION_API_KEY, NOTION_DOCS_DB_ID } = await getIntegrationsAsync();
  if (!NOTION_API_KEY || !NOTION_DOCS_DB_ID) return [];

  try {
    const results = await notionFetchAll<unknown>(
      `/databases/${NOTION_DOCS_DB_ID}/query`,
      {
        filter: { property: "Published", checkbox: { equals: true } },
        sorts: [
          { property: "Category", direction: "ascending" },
          { property: "Order", direction: "ascending" },
        ],
      },
    );

    /* eslint-disable @typescript-eslint/no-explicit-any */
    return (results as any[]).map(mapWikiPage);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch (err) {
    console.error("[Notion Wiki] Failed to fetch wiki docs:", err);
    return [];
  }
}

/**
 * Get docs that need re-verification (stale content).
 */
export async function getDocsNeedingVerification(): Promise<WikiDocRecord[]> {
  const docs = await getWikiDocs();
  return docs.filter(
    (d) =>
      d.verificationStatus === "Needs re-verification" ||
      d.verificationStatus === "Unverified",
  );
}

/**
 * Get docs owned by a specific person.
 */
export async function getDocsByOwner(
  ownerName: string,
): Promise<WikiDocRecord[]> {
  const docs = await getWikiDocs();
  return docs.filter((d) =>
    d.owner.toLowerCase().includes(ownerName.toLowerCase()),
  );
}

/**
 * Search docs by title or description (client-side filter).
 */
export async function searchDocs(query: string): Promise<DocRecord[]> {
  if (!query.trim()) return [];
  const docs = await getDocs();
  const q = query.toLowerCase();
  return docs.filter(
    (d) =>
      d.title.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q),
  );
}

/**
 * Get doc content with table of contents.
 */
export async function getDocContentWithToc(
  pageId: string,
): Promise<(DocContent & { toc: import("@/lib/notion").TocEntry[] }) | null> {
  const { NOTION_API_KEY } = await getIntegrationsAsync();
  if (!NOTION_API_KEY) return null;

  try {
    const page = await notionFetch<unknown>(`/pages/${pageId}`);
    const blocks = await notionListAll<unknown>(`/blocks/${pageId}/children`);

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const record = mapPage(page as any);
    const html = blocksToHtml(blocks as any[]);

    const { extractToc } = await import("@/lib/notion");
    const toc = extractToc(blocks as any[]);
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return { ...record, html, toc };
  } catch (err) {
    console.error("[Notion Docs] Failed to fetch doc content with TOC:", err);
    return null;
  }
}
