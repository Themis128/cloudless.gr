/**
 * Shared Notion API client utilities.
 *
 * Provides:
 *  - notionFetch()     — authenticated fetch wrapper
 *  - notionHeaders()   — Authorization + Notion-Version headers
 *  - blocksToHtml()    — converts Notion block array → safe HTML string
 *  - extractText()     — collapses rich_text arrays to plain string
 */

import { getIntegrationsAsync } from "@/lib/integrations";

export const NOTION_API = "https://api.notion.com/v1";
export const NOTION_VERSION = "2022-06-28";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

export async function notionHeaders(): Promise<Record<string, string>> {
  const { NOTION_API_KEY } = await getIntegrationsAsync();
  if (!NOTION_API_KEY) throw new Error("NOTION_API_KEY is not configured");
  return {
    Authorization: `Bearer ${NOTION_API_KEY}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Fetch wrapper
// ---------------------------------------------------------------------------

export async function notionFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const MAX_RETRIES = 3;
  const headers = await notionHeaders();
  const url = `${NOTION_API}${path}`;
  const reqInit: RequestInit = {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, reqInit);

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfterRaw = parseInt(res.headers.get("Retry-After") ?? "1", 10);
      await sleep((isNaN(retryAfterRaw) ? 1 : retryAfterRaw) * 1000);
      continue;
    }

    if (res.status >= 500 && attempt < MAX_RETRIES) {
      await sleep(2 ** attempt * 500);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Notion API error ${res.status} on ${path}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  throw new Error(`Notion API: max retries exceeded for ${path}`);
}

// ---------------------------------------------------------------------------
// Rich-text helpers
// ---------------------------------------------------------------------------

type RichTextItem = {
  plain_text: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
  };
};

export function extractText(richText: RichTextItem[] | undefined): string {
  return (richText ?? []).map((t) => t.plain_text).join("");
}

function richTextToHtml(richText: RichTextItem[]): string {
  return (richText ?? [])
    .map((t) => {
      let text = t.plain_text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      if (t.annotations?.bold) text = `<strong>${text}</strong>`;
      if (t.annotations?.italic) text = `<em>${text}</em>`;
      if (t.annotations?.code) text = `<code>${text}</code>`;
      if (t.annotations?.strikethrough) text = `<s>${text}</s>`;
      if (t.annotations?.underline) text = `<u>${text}</u>`;
      if (t.href)
        text = `<a href="${t.href}" target="_blank" rel="noopener">${text}</a>`;

      return text;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Block → HTML renderer
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
export function blocksToHtml(blocks: any[]): string {
  const lines: string[] = [];
  let listBuffer: string[] = [];
  let listType: "ul" | "ol" | null = null;

  function flushList() {
    if (listBuffer.length === 0) return;
    const tag = listType === "ol" ? "ol" : "ul";
    lines.push(`<${tag}>${listBuffer.join("")}</${tag}>`);
    listBuffer = [];
    listType = null;
  }

  for (const block of blocks) {
    const type: string = block.type;
    const data = block[type] ?? {};
    const rt: RichTextItem[] = data.rich_text ?? [];
    const text = richTextToHtml(rt);

    // List items need buffering so we can wrap in <ul>/<ol>
    if (type === "bulleted_list_item") {
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listBuffer.push(`<li>${text}</li>`);
      continue;
    }
    if (type === "numbered_list_item") {
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listBuffer.push(`<li>${text}</li>`);
      continue;
    }

    flushList();

    switch (type) {
      case "paragraph":
        lines.push(text ? `<p>${text}</p>` : "<br />");
        break;
      case "heading_1":
        lines.push(`<h1>${text}</h1>`);
        break;
      case "heading_2":
        lines.push(`<h2>${text}</h2>`);
        break;
      case "heading_3":
        lines.push(`<h3>${text}</h3>`);
        break;
      case "code":
        lines.push(
          `<pre><code class="language-${data.language ?? "plain"}">${extractText(
            rt,
          )
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</code></pre>`,
        );
        break;
      case "quote":
        lines.push(`<blockquote>${text}</blockquote>`);
        break;
      case "divider":
        lines.push("<hr />");
        break;
      case "callout": {
        const calloutBody = block.children ? blocksToHtml(block.children) : "";
        const calloutSuffix = calloutBody ? "\n" + calloutBody : "";
        lines.push(
          `<div class="callout">${data.icon?.emoji ?? ""} ${text}${calloutSuffix}</div>`,
        );
        break;
      }
      case "image": {
        const url =
          data.type === "external"
            ? data.external?.url
            : notionImageProxyUrl(block.id);
        const caption = extractText(data.caption);
        if (url) {
          lines.push(
            `<figure><img src="${url}" alt="${caption}" loading="lazy" />${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`,
          );
        }
        break;
      }
      case "video": {
        const url =
          data.type === "external" ? data.external?.url : data.file?.url;
        if (url) lines.push(`<video controls src="${url}"></video>`);
        break;
      }
      case "embed":
      case "bookmark":
        lines.push(
          `<a href="${data.url}" target="_blank" rel="noopener">${data.url}</a>`,
        );
        break;
      case "to_do":
        lines.push(
          `<label class="todo"><input type="checkbox" disabled ${data.checked ? "checked" : ""} /> ${text}</label>`,
        );
        break;
      case "toggle": {
        const toggleBody = block.children ? blocksToHtml(block.children) : "";
        const toggleSuffix = toggleBody ? "\n" + toggleBody : "";
        lines.push(
          `<details><summary>${text}</summary>${toggleSuffix}</details>`,
        );
        break;
      }
      default:
        // Unknown block type — render plain text if present
        if (text) lines.push(`<p>${text}</p>`);
    }
  }

  flushList();
  return lines.join("\n");
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Pagination helper — fetches ALL pages of a paginated Notion response
// ---------------------------------------------------------------------------

/**
 * Paginated POST — for database queries (POST /databases/{id}/query).
 */
export async function notionFetchAll<T = unknown>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T[]> {
  const results: T[] = [];
  let cursor: string | undefined;

  do {
    const payload = {
      ...(body ?? {}),
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    };
    const data = await notionFetch<{
      results: T[];
      has_more: boolean;
      next_cursor?: string;
    }>(path, { method: "POST", body: JSON.stringify(payload) });
    results.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return results;
}

/**
 * Paginated GET — for list endpoints (GET /blocks/{id}/children).
 */
export async function notionListAll<T = unknown>(path: string): Promise<T[]> {
  const results: T[] = [];
  let cursor: string | undefined;

  do {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${path}${sep}page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`;
    const data = await notionFetch<{
      results: T[];
      has_more: boolean;
      next_cursor?: string;
    }>(url);
    results.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return results;
}

// ---------------------------------------------------------------------------
// Deep block fetcher — recursively fetches children for nested blocks
// ---------------------------------------------------------------------------

export interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  children?: NotionBlock[];
  [key: string]: unknown;
}

/**
 * Fetch all blocks under a parent, recursively expanding any block that
 * has `has_children: true` (e.g. toggle, callout, column_list).
 */
export async function fetchBlocksDeep(
  parentId: string,
): Promise<NotionBlock[]> {
  const blocks = await notionListAll<NotionBlock>(
    `/blocks/${parentId}/children`,
  );
  for (const block of blocks) {
    if (block.has_children) {
      block.children = await fetchBlocksDeep(block.id);
    }
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Image proxy URL helper — avoids Notion signed-URL expiry in rendered HTML
// ---------------------------------------------------------------------------

/**
 * Returns the local image-proxy URL for a Notion-hosted file.
 * The proxy route re-fetches the fresh signed URL on each request.
 */
export function notionImageProxyUrl(
  id: string,
  type: "block" | "cover" = "block",
): string {
  return `/api/notion-image?id=${encodeURIComponent(id)}&type=${type}`;
}

// ---------------------------------------------------------------------------
// Page helpers — update, archive, delete
// ---------------------------------------------------------------------------

/**
 * Update page properties via PATCH.
 * Accepts a plain object of property updates.
 */
export async function updatePage(
  pageId: string,
  properties: Record<string, unknown>,
): Promise<boolean> {
  try {
    await notionFetch(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });
    return true;
  } catch (err) {
    console.error(`[Notion] Failed to update page ${pageId}:`, err);
    return false;
  }
}

/**
 * Archive (soft-delete) a page.
 */
export async function archivePage(pageId: string): Promise<boolean> {
  try {
    await notionFetch(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    });
    return true;
  } catch (err) {
    console.error(`[Notion] Failed to archive page ${pageId}:`, err);
    return false;
  }
}

/**
 * Restore a previously archived page.
 */
export async function restorePage(pageId: string): Promise<boolean> {
  try {
    await notionFetch(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: false }),
    });
    return true;
  } catch (err) {
    console.error(`[Notion] Failed to restore page ${pageId}:`, err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Block helpers — append, delete
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Append child blocks to a page or block.
 * Max 100 blocks per call (Notion API limit).
 */
export async function appendBlocks(
  parentId: string,
  children: any[],
): Promise<boolean> {
  try {
    await notionFetch(`/blocks/${parentId}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: children.slice(0, 100) }),
    });
    return true;
  } catch (err) {
    console.error(`[Notion] Failed to append blocks to ${parentId}:`, err);
    return false;
  }
}

/**
 * Delete (archive) a block.
 */
export async function deleteBlock(blockId: string): Promise<boolean> {
  try {
    await notionFetch(`/blocks/${blockId}`, { method: "DELETE" });
    return true;
  } catch (err) {
    console.error(`[Notion] Failed to delete block ${blockId}:`, err);
    return false;
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Block builder helpers — construct Notion block objects
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

export function textBlock(type: string, content: string): any {
  return {
    object: "block",
    type,
    [type]: { rich_text: [{ text: { content } }] },
  };
}

export function paragraphBlock(content: string) {
  return textBlock("paragraph", content);
}

export function headingBlock(level: 1 | 2 | 3, content: string) {
  const type = `heading_${level}`;
  return textBlock(type, content);
}

export function bulletBlock(content: string) {
  return textBlock("bulleted_list_item", content);
}

export function numberedBlock(content: string) {
  return textBlock("numbered_list_item", content);
}

export function todoBlock(content: string, checked = false): any {
  return {
    object: "block",
    type: "to_do",
    to_do: {
      rich_text: [{ text: { content } }],
      checked,
    },
  };
}

export function codeBlock(content: string, language = "plain text"): any {
  return {
    object: "block",
    type: "code",
    code: {
      rich_text: [{ text: { content } }],
      language,
    },
  };
}

export function dividerBlock(): any {
  return { object: "block", type: "divider", divider: {} };
}

export function calloutBlock(content: string, emoji = "💡"): any {
  return {
    object: "block",
    type: "callout",
    callout: {
      rich_text: [{ text: { content } }],
      icon: { type: "emoji", emoji },
    },
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Table of Contents extractor
// ---------------------------------------------------------------------------

export interface TocEntry {
  text: string;
  level: 1 | 2 | 3;
  blockId: string;
}

interface TocBlock {
  type: string;
  id: string;
  heading_1?: { rich_text: Array<{ plain_text: string }> };
  heading_2?: { rich_text: Array<{ plain_text: string }> };
  heading_3?: { rich_text: Array<{ plain_text: string }> };
}

/**
 * Extract a table of contents from Notion blocks (heading blocks only).
 */
export function extractToc(blocks: TocBlock[]): TocEntry[] {
  const toc: TocEntry[] = [];
  for (const block of blocks) {
    if (block.type === "heading_1") {
      toc.push({
        text: extractText(block.heading_1?.rich_text),
        level: 1,
        blockId: block.id,
      });
    } else if (block.type === "heading_2") {
      toc.push({
        text: extractText(block.heading_2?.rich_text),
        level: 2,
        blockId: block.id,
      });
    } else if (block.type === "heading_3") {
      toc.push({
        text: extractText(block.heading_3?.rich_text),
        level: 3,
        blockId: block.id,
      });
    }
  }
  return toc;
}
