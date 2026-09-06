/**
 * AppFlowy Comments — placeholder for comments functionality.
 *
 * AppFlowy doesn't currently have a comments API equivalent to Notion.
 * This module provides a compatible interface that returns empty results.
 */

export interface Comment {
  id: string;
  pageId: string;
  author: { name: string; avatar?: string };
  text: string;
  createdAt: string;
}

/**
 * List comments for a page.
 * AppFlowy doesn't support comments yet — returns empty array.
 */
export async function listComments(_pageId: string): Promise<Comment[]> {
  // AppFlowy doesn't have comments API
  return [];
}

/**
 * Add a comment to a page.
 * AppFlowy doesn't support comments yet — returns false.
 */
export async function addComment(_pageId: string, _text: string): Promise<boolean> {
  // AppFlowy doesn't have comments API — do not log pageId/text (log-injection).
  console.warn("[AppFlowy Comments] Would add comment (stub)");
  return false;
}
