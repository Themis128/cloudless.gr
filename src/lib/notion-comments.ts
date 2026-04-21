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
import { isConfiguredAsync } from "@/lib/integrations";

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

/* eslint-disable @typescript-eslint/no-explicit-any */
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
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List all comments on a page or block.
 * Supports pagination via the Notion list endpoint.
 */
export async function listComments(blockId: string): Promise<NotionComment[]> {
  if (!await isConfiguredAsync("NOTION_API_KEY")) return [];

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const results = await notionListAll<any>(`/comments?block_id=${blockId}`);
    return results.map(mapComment);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch (err) {
    console.error("[Notion Comments] Failed to list comments:", err);
    return [];
  }
}

/**
 * Add a comment to a page. Returns the created comment or null.
 *
 * Note: The Notion API only supports adding comments to pages (not blocks)
 * when using an internal integration.
 */
export async function addComment(
  pageId: string,
  text: string,
): Promise<NotionComment | null> {
  if (!await isConfiguredAsync("NOTION_API_KEY")) return null;

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const result = await notionFetch<any>("/comments", {
      method: "POST",
      body: JSON.stringify({
        parent: { page_id: pageId },
        rich_text: [{ text: { content: text.slice(0, 2000) } }],
      }),
    });
    return mapComment(result);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch (err) {
    console.error("[Notion Comments] Failed to add comment:", err);
    return null;
  }
}

/**
 * Reply to an existing discussion thread.
 */
export async function replyToDiscussion(
  discussionId: string,
  text: string,
): Promise<NotionComment | null> {
  if (!await isConfiguredAsync("NOTION_API_KEY")) return null;

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const result = await notionFetch<any>("/comments", {
      method: "POST",
      body: JSON.stringify({
        discussion_id: discussionId,
        rich_text: [{ text: { content: text.slice(0, 2000) } }],
      }),
    });
    return mapComment(result);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch (err) {
    console.error("[Notion Comments] Failed to reply to discussion:", err);
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
