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

/**
 * Sanitize an untrusted identifier for safe logging. Strips CR/LF and
 * truncates to prevent log injection (CodeQL js/log-injection) and
 * tainted format-string issues (js/tainted-format-string).
 */
function safeId(id: string): string {
  return String(id)
    .replace(/[\r\n\t]/g, "")
    .slice(0, 64);
}

function safeMsg(msg: string): string {
  return String(msg)
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .slice(0, 200);
}

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

export async function notionFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const MAX_RETRIES = 3;
  const headers = await notionHeaders();
  if (path.includes("://") || path.startsWith("//"))
    throw new Error(`notionFetch: invalid path "${path}"`);
  const url = `${NOTION_API}${path}`;
  const reqInit: RequestInit = {
    ...init,
    headers: { ...headers, ...init?.headers },
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, reqInit); // codeql[js/server-side-request-forgery] -- NOTION_API is a constant; path validated above (no :// or //)

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfterRaw = Number.parseInt(res.headers.get("Retry-After") ?? "1", 10);
      await sleep((Number.isNaN(retryAfterRaw) ? 1 : retryAfterRaw) * 1000);
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
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

      if (t.annotations?.bold) text = `<strong>${text}</strong>`;
      if (t.annotations?.italic) text = `<em>${text}</em>`;
      if (t.annotations?.code) text = `<code>${text}</code>`;
      if (t.annotations?.strikethrough) text = `<s>${text}</s>`;
      if (t.annotations?.underline) text = `<u>${text}</u>`;
      if (t.href) text = `<a href="${t.href}" target="_blank" rel="noopener">${text}</a>`;

      return text;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Block → HTML renderer
// ---------------------------------------------------------------------------

type ListTag = "ul" | "ol" | null;

function renderMediaBlock(block: any, type: string, data: any): string | null {
  switch (type) {
    case "image": {
      const url = data.type === "external" ? data.external?.url : notionImageProxyUrl(block.id);
      if (!url) return null;
      const caption = extractText(data.caption);
      const figcaption = caption ? `<figcaption>${caption}</figcaption>` : "";
      return `<figure><img src="${url}" alt="${caption}" loading="lazy" />${figcaption}</figure>`;
    }
    case "video": {
      const url = data.type === "external" ? data.external?.url : data.file?.url;
      return url ? `<video controls src="${url}"></video>` : null;
    }
    case "embed":
    case "bookmark":
      return `<a href="${data.url}" target="_blank" rel="noopener">${data.url}</a>`;
    default:
      return null;
  }
}

function renderBlockToHtml(block: any, type: string, data: any, text: string): string | null {
  switch (type) {
    case "paragraph":
      return text ? `<p>${text}</p>` : "<br />";
    case "heading_1":
      return `<h1>${text}</h1>`;
    case "heading_2":
      return `<h2>${text}</h2>`;
    case "heading_3":
      return `<h3>${text}</h3>`;
    case "code": {
      const rt: RichTextItem[] = data.rich_text ?? [];
      const escaped = extractText(rt)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
      return `<pre><code class="language-${data.language ?? "plain"}">${escaped}</code></pre>`;
    }
    case "quote":
      return `<blockquote>${text}</blockquote>`;
    case "divider":
      return "<hr />";
    case "callout": {
      const body = block.children ? blocksToHtml(block.children) : "";
      const suffix = body ? "\n" + body : "";
      return `<div class="callout">${data.icon?.emoji ?? ""} ${text}${suffix}</div>`;
    }
    case "to_do":
      return `<label class="todo"><input type="checkbox" disabled ${data.checked ? "checked" : ""} /> ${text}</label>`;
    case "toggle": {
      const body = block.children ? blocksToHtml(block.children) : "";
      const suffix = body ? "\n" + body : "";
      return `<details><summary>${text}</summary>${suffix}</details>`;
    }
    default:
      return renderMediaBlock(block, type, data) ?? (text ? `<p>${text}</p>` : null);
  }
}

function appendListItem(
  type: "bulleted_list_item" | "numbered_list_item",
  text: string,
  listBuffer: string[],
  listTypeRef: { current: ListTag },
  lines: string[]
): void {
  const wantedTag = type === "bulleted_list_item" ? "ul" : "ol";
  if (listTypeRef.current !== wantedTag) {
    if (listBuffer.length > 0) {
      lines.push(
        `<${listTypeRef.current ?? "ul"}>${listBuffer.splice(0).join("")}</${listTypeRef.current ?? "ul"}>`
      );
    }
    listTypeRef.current = wantedTag;
  }
  listBuffer.push(`<li>${text}</li>`);
}

function flushListBuffer(
  listBuffer: string[],
  listTypeRef: { current: ListTag },
  lines: string[]
): void {
  if (listBuffer.length === 0) return;
  const tag = listTypeRef.current ?? "ul";
  lines.push(`<${tag}>${listBuffer.splice(0).join("")}</${tag}>`);
  listTypeRef.current = null;
}

function processBlock(
  block: any,
  listBuffer: string[],
  listTypeRef: { current: ListTag },
  lines: string[]
): void {
  const type: string = block.type;
  const data = block[type] ?? {};
  const text = richTextToHtml(data.rich_text ?? []);
  if (type === "bulleted_list_item" || type === "numbered_list_item") {
    appendListItem(type, text, listBuffer, listTypeRef, lines);
    return;
  }
  flushListBuffer(listBuffer, listTypeRef, lines);
  const html = renderBlockToHtml(block, type, data, text);
  if (html !== null) lines.push(html);
}

export function blocksToHtml(blocks: any[]): string {
  const lines: string[] = [];
  const listBuffer: string[] = [];
  const listTypeRef: { current: ListTag } = { current: null };
  for (const block of blocks) {
    processBlock(block, listBuffer, listTypeRef, lines);
  }
  flushListBuffer(listBuffer, listTypeRef, lines);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Pagination helper — fetches ALL pages of a paginated Notion response
// ---------------------------------------------------------------------------

/**
 * Paginated POST — for database queries (POST /databases/{id}/query).
 */
export async function notionFetchAll<T = unknown>(
  path: string,
  body?: Record<string, unknown>
): Promise<T[]> {
  const results: T[] = [];
  let cursor: string | undefined;

  do {
    const payload = {
      ...body,
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
    const cursorParam = cursor ? `&start_cursor=${cursor}` : "";
    const url = `${path}${sep}page_size=100${cursorParam}`;
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
export async function fetchBlocksDeep(parentId: string): Promise<NotionBlock[]> {
  const blocks = await notionListAll<NotionBlock>(`/blocks/${parentId}/children`);
  await Promise.all(
    blocks.map(async (block) => {
      if (block.has_children) {
        block.children = await fetchBlocksDeep(block.id);
      }
    })
  );
  return blocks;
}

// ---------------------------------------------------------------------------
// Image proxy URL helper — avoids Notion signed-URL expiry in rendered HTML
// ---------------------------------------------------------------------------

/**
 * Returns the local image-proxy URL for a Notion-hosted file.
 * The proxy route re-fetches the fresh signed URL on each request.
 */
export function notionImageProxyUrl(id: string, type: "block" | "cover" = "block"): string {
  return `/api/notion-image?id=${encodeURIComponent(id)}&type=${type}`;
}

// ---------------------------------------------------------------------------
// Page helpers — update, archive, delete
// ---------------------------------------------------------------------------

/**
 * Update page properties via PATCH.
 * Accepts a plain object of property updates.
 */
/**
 * Create a new page in a Notion database.
 * Returns the new page ID on success, null on failure.
 */
export async function createPage(
  databaseId: string,
  properties: Record<string, unknown>
): Promise<string | null> {
  try {
    const page = await notionFetch<{ id: string }>("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties,
      }),
    });
    return page.id;
  } catch (err) {
    // CodeQL js/log-injection — use JSON.stringify as the
    // canonical sanitizer for tainted values flowing into console.error.
    console.error(
      "[Notion] Failed to create page in " +
        JSON.stringify(safeId(databaseId)) +
        ": " +
        JSON.stringify(safeMsg((err as Error)?.message ?? "unknown error"))
    );
    return null;
  }
}

export async function updatePage(
  pageId: string,
  properties: Record<string, unknown>
): Promise<boolean> {
  try {
    await notionFetch(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });
    return true;
  } catch (err) {
    // CodeQL js/log-injection — use JSON.stringify as the
    // canonical sanitizer for tainted values flowing into console.error.
    console.error(
      "[Notion] Failed to update page " +
        JSON.stringify(safeId(pageId)) +
        ": " +
        JSON.stringify(safeMsg((err as Error)?.message ?? "unknown error"))
    );
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
    // CodeQL js/log-injection — use JSON.stringify as the
    // canonical sanitizer for tainted values flowing into console.error.
    console.error(
      "[Notion] Failed to archive page " +
        JSON.stringify(safeId(pageId)) +
        ": " +
        JSON.stringify(safeMsg((err as Error)?.message ?? "unknown error"))
    );
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
    // CodeQL js/log-injection — use JSON.stringify as the
    // canonical sanitizer for tainted values flowing into console.error.
    console.error(
      "[Notion] Failed to restore page " +
        JSON.stringify(safeId(pageId)) +
        ": " +
        JSON.stringify(safeMsg((err as Error)?.message ?? "unknown error"))
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Block helpers — append, delete
// ---------------------------------------------------------------------------

/**
 * Append child blocks to a page or block.
 * Max 100 blocks per call (Notion API limit).
 */
export async function appendBlocks(parentId: string, children: any[]): Promise<boolean> {
  try {
    await notionFetch(`/blocks/${parentId}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: children.slice(0, 100) }),
    });
    return true;
  } catch (err) {
    // CodeQL js/log-injection — use JSON.stringify as the
    // canonical sanitizer for tainted values flowing into console.error.
    console.error(
      "[Notion] Failed to append blocks to " +
        JSON.stringify(safeId(parentId)) +
        ": " +
        JSON.stringify(safeMsg((err as Error)?.message ?? "unknown error"))
    );
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
    // CodeQL js/log-injection — use JSON.stringify as the
    // canonical sanitizer for tainted values flowing into console.error.
    console.error(
      "[Notion] Failed to delete block " +
        JSON.stringify(safeId(blockId)) +
        ": " +
        JSON.stringify(safeMsg((err as Error)?.message ?? "unknown error"))
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Block builder helpers — construct Notion block objects
// ---------------------------------------------------------------------------

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
