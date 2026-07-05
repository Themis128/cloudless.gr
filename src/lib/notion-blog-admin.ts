/**
 * Notion Blog admin helpers — used by the Slack ops surface to list
 * drafts and flip the editorial status from Slack without opening Notion.
 *
 * Kept separate from src/lib/notion-blog.ts (which serves the public
 * `/blog` frontend) so admin functionality cannot accidentally leak
 * through the public render path.
 *
 * All functions read NOTION_API_KEY and NOTION_BLOG_DB_ID from SSM via
 * getConfig(). They return [] / null on any failure and log the error
 * — never throw — so a transient Notion outage cannot 500 a Slack
 * interaction handler. The handler surfaces the empty/null and responds
 * with an ephemeral warning instead.
 */

import { getConfig } from "@/lib/ssm-config";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/** The four select values that exist on the Notion Blog DB Status field. */
export type NotionBlogStatus = "Draft" | "In Review" | "Published" | "Archived";

export interface NotionBlogDraft {
  id: string;
  title: string;
  slug: string;
  status: NotionBlogStatus | "";
  category: string;
  readTime: string;
  createdAt: string;
  /** Direct Notion app URL — opens the page in the user's Notion workspace. */
  url: string;
}

interface NotionRichText {
  plain_text?: string;
}
interface NotionPageRaw {
  id: string;
  url?: string;
  created_time?: string;
  properties: Record<string, unknown>;
}

function rt(value: unknown): string {
  const arr =
    (value as { title?: NotionRichText[]; rich_text?: NotionRichText[] } | undefined)?.title ??
    (value as { rich_text?: NotionRichText[] } | undefined)?.rich_text ??
    [];
  return arr.map((t) => t.plain_text ?? "").join("");
}

function selectName(value: unknown): string {
  return (value as { select?: { name?: string } } | undefined)?.select?.name ?? "";
}

function mapPage(page: NotionPageRaw): NotionBlogDraft {
  const p = page.properties;
  return {
    id: page.id,
    title: rt(p.Title) || rt(p.Name) || "(untitled)",
    slug: rt(p.Slug),
    status: (selectName(p.Status) || "") as NotionBlogStatus | "",
    category: selectName(p.Category) || "Cloud",
    readTime: rt(p.ReadTime) || "5 min read",
    createdAt: page.created_time ?? "",
    url: page.url ?? `https://www.notion.so/${page.id.replace(/-/g, "")}`,
  };
}

async function notionFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const config = await getConfig();
  return fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
}

/**
 * List every Notion Blog row whose Status is in the editorial-active set
 * (Draft or In Review). Sorted newest first.
 *
 * Returns [] on failure (logged). The Slack handler turns an empty
 * response into a "no drafts found" message rather than a 500.
 */
export async function listEditorialPosts(): Promise<NotionBlogDraft[]> {
  try {
    const config = await getConfig();
    if (!config.NOTION_BLOG_DB_ID) {
      console.error("[notion-blog-admin] NOTION_BLOG_DB_ID is not configured in SSM");
      return [];
    }
    const res = await notionFetch(`/databases/${config.NOTION_BLOG_DB_ID}/query`, {
      method: "POST",
      body: JSON.stringify({
        filter: {
          or: [
            { property: "Status", select: { equals: "Draft" } },
            { property: "Status", select: { equals: "In Review" } },
          ],
        },
        sorts: [{ timestamp: "created_time", direction: "descending" }],
        page_size: 25,
      }),
    });
    if (!res.ok) {
      console.error(
        `[notion-blog-admin] list query failed: ${res.status} ${await res.text().catch(() => "")}`
      );
      return [];
    }
    const data = (((await res.json()) as any)) as { results: NotionPageRaw[] };
    return data.results.map(mapPage);
  } catch (err) {
    console.error("[notion-blog-admin] listEditorialPosts error:", err);
    return [];
  }
}

/**
 * Resolve a Notion page either by its full id (with or without hyphens)
 * or by its blog Slug. Returns null when nothing matches.
 *
 * The id path is preferred because it is unambiguous and skips the search.
 * Slug is convenience for humans typing the readable identifier in Slack.
 */
export async function findEditorialPost(idOrSlug: string): Promise<NotionBlogDraft | null> {
  const trimmed = idOrSlug.trim();
  if (!trimmed) return null;

  // 32-hex or hyphenated UUID looks like a Notion id — try direct fetch first.
  const looksLikeId = /^[0-9a-f]{32}$|^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
    trimmed.replace(/[^0-9a-f-]/gi, "")
  );
  if (looksLikeId) {
    try {
      const cleanId = trimmed.replace(/[^0-9a-f-]/gi, "");
      const res = await notionFetch(`/pages/${cleanId}`);
      if (res.ok) {
        const page = (((await res.json()) as any)) as NotionPageRaw;
        return mapPage(page);
      }
    } catch (err) {
      console.warn("[notion-blog-admin] direct id fetch failed, falling back to slug:", err);
    }
  }

  // Slug lookup — query DB for an exact slug match.
  try {
    const config = await getConfig();
    if (!config.NOTION_BLOG_DB_ID) return null;
    const res = await notionFetch(`/databases/${config.NOTION_BLOG_DB_ID}/query`, {
      method: "POST",
      body: JSON.stringify({
        filter: { property: "Slug", rich_text: { equals: trimmed } },
        page_size: 1,
      }),
    });
    if (!res.ok) return null;
    const data = (((await res.json()) as any)) as { results: NotionPageRaw[] };
    return data.results[0] ? mapPage(data.results[0]) : null;
  } catch (err) {
    console.error("[notion-blog-admin] findEditorialPost error:", err);
    return null;
  }
}

/**
 * Flip the Status select on a Notion Blog row. Used by the Slack
 * /cloudless-newsletter send flow to move a Draft into In Review
 * before triggering the publisher workflow.
 *
 * Returns true on success, false on failure (logged).
 */
export async function setEditorialStatus(
  pageId: string,
  status: NotionBlogStatus
): Promise<boolean> {
  try {
    const res = await notionFetch(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          Status: { select: { name: status } },
        },
      }),
    });
    if (!res.ok) {
      console.error(
        `[notion-blog-admin] setEditorialStatus failed: ${res.status} ${await res.text().catch(() => "")}`
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notion-blog-admin] setEditorialStatus error:", err);
    return false;
  }
}
