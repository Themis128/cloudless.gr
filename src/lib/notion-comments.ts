/**
 * Notion Comments API.
 *
 * Create and retrieve comments on Notion pages and discussion threads.
 * Useful for internal review workflows and wiki verification processes.
 *
 * Skills used:
 *   - notion-search-users (Comments API reference)
 *   - notion-wikis (verification workflows that use comments)
 */

import { notionFetch, notionListAll, extractText } from "@/lib/notion";
import { requireIntegrationAsync } from "@/lib/integrations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotionComment {
  id: string;
  parentPageId: string;
  discussionId: string;
  createdTime: string;
  lastEditedTime: string;
  createdByUserId: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function mapComment(comment: any): NotionComment {
  return {
    id: comment.id,
    parentPageId: comment.parent?.page_id ?? comment.parent?.block_id ?? "",
    discussionId: comment.discussion_id ?? "",
    createdTime: comment.created_time ?? "",
    lastEditedTime: comment.last_edited_time ?? "",
    createdByUserId: comment.created_by?.id ?? "",
    text: extractText(comment.rich_text),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List all comments on a page or block.
 * Supports pagination via the Notion list endpoint.
 */
export async function listComments(blockId: string): Promise<NotionComment[]> {
  await requireIntegrationAsync("NOTION_API_KEY");

  try {
    const results = await notionListAll<any>(`/comments?block_id=${blockId}`);
    return results.map(mapComment);
  } catch (err) {
    const msg = ((err as Error)?.message ?? "unknown error").replace(/[\r\n]/g, " ");
    console.error("[Notion Comments] Failed to list comments:", msg); // codeql[js/log-injection]
    return [];
  }
}

/**
 * Add a comment to a page. Returns the created comment or null.
 *
 * Note: The Notion API only supports adding comments to pages (not blocks)
 * when using an internal integration.
 */
export async function addComment(pageId: string, text: string): Promise<NotionComment | null> {
  await requireIntegrationAsync("NOTION_API_KEY");

  try {
    const result = await notionFetch<any>("/comments", {
      method: "POST",
      body: JSON.stringify({
        parent: { page_id: pageId },
        rich_text: [{ text: { content: text.slice(0, 2000) } }],
      }),
    });
    return mapComment(result);
  } catch (err) {
    const msg = ((err as Error)?.message ?? "unknown error").replace(/[\r\n]/g, " ");
    console.error("[Notion Comments] Failed to add comment:", msg); // codeql[js/log-injection]
    return null;
  }
}

/**
 * Reply to an existing discussion thread.
 */
export async function replyToDiscussion(
  discussionId: string,
  text: string
): Promise<NotionComment | null> {
  await requireIntegrationAsync("NOTION_API_KEY");

  try {
    const result = await notionFetch<any>("/comments", {
      method: "POST",
      body: JSON.stringify({
        discussion_id: discussionId,
        rich_text: [{ text: { content: text.slice(0, 2000) } }],
      }),
    });
    return mapComment(result);
  } catch (err) {
    const msg = ((err as Error)?.message ?? "unknown error").replace(/[\r\n]/g, " ");
    console.error("[Notion Comments] Failed to reply to discussion:", msg); // codeql[js/log-injection]
    return null;
  }
}

/**
 * Get the number of comments on a page (useful for UI badges).
 */
export async function getCommentCount(blockId: string): Promise<number> {
  const comments = await listComments(blockId);
  return comments.length;
}
