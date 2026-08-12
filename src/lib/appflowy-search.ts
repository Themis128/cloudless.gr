/**
 * AppFlowy Search — unified search across AppFlowy documents.
 *
 * Provides search functionality for the admin panel.
 */

import {
  listAllWorkspaces,
  listAllViewsDeep,
  getDocument,
  extractDocText,
  isAppFlowyConfigured,
  searchDocuments,
} from "./appflowy";

export interface SearchResult {
  id: string;
  title: string;
  type: "page" | "database";
  url: string;
  lastEdited: string;
  excerpt: string;
}

export interface DatabaseSchema {
  id: string;
  title: string;
  properties: Record<string, { type: string }>;
}

/**
 * Search AppFlowy pages/documents by query string.
 */
export async function searchPages(query: string, limit = 20): Promise<SearchResult[]> {
  if (!(await isAppFlowyConfigured())) return [];

  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  try {
    const workspaceId = (await listAllWorkspaces())[0]?.workspace_id;
    if (!workspaceId) return [];

    const views = await searchDocuments(workspaceId, trimmed);
    const results: SearchResult[] = [];

    for (const view of views.slice(0, limit)) {
      try {
        const doc = await getDocument(workspaceId, view.view_id);
        const text = await extractDocText(doc);
        const excerpt = text.slice(0, 200).replace(/\n/g, " ") + (text.length > 200 ? "..." : "");

        results.push({
          id: view.view_id,
          title: view.name,
          type: view.type === "folder" ? "database" : "page",
          url: "",
          lastEdited: view.last_edited_time,
          excerpt,
        });
      } catch {
        // Skip failed documents
      }
    }

    return results;
  } catch (err) {
    const msg = ((err as Error)?.message ?? "unknown error").replace(/[\r\n]/g, " ");
    console.error("[AppFlowy Search] searchPages error:", msg);
    return [];
  }
}

/**
 * Search AppFlowy databases (folders) by query string.
 */
export async function searchDatabases(query: string, limit = 20): Promise<SearchResult[]> {
  if (!(await isAppFlowyConfigured())) return [];

  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  try {
    const workspaceId = (await listAllWorkspaces())[0]?.workspace_id;
    if (!workspaceId) return [];

    const views = await listAllViewsDeep(workspaceId);
    const folderViews = views.filter(
      (v) => v.type === "folder" && v.name.toLowerCase().includes(trimmed)
    );

    return folderViews.slice(0, limit).map((v) => ({
      id: v.view_id,
      title: v.name,
      type: "database",
      url: "",
      lastEdited: v.last_edited_time,
      excerpt: `Folder with ${v.name}`,
    }));
  } catch (err) {
    const msg = ((err as Error)?.message ?? "unknown error").replace(/[\r\n]/g, " ");
    console.error("[AppFlowy Search] searchDatabases error:", msg);
    return [];
  }
}

/**
 * List all AppFlowy users (from workspace members).
 */
export async function listUsers(): Promise<Array<{ id: string; name: string; email: string }>> {
  if (!(await isAppFlowyConfigured())) return [];

  try {
    // AppFlowy doesn't have a direct users API in our client
    // This would come from the workspace members
    return [];
  } catch (err) {
    const msg = ((err as Error)?.message ?? "unknown error").replace(/[\r\n]/g, " ");
    console.error("[AppFlowy Search] listUsers error:", msg);
    return [];
  }
}

/**
 * Get database schema for a folder (not applicable to AppFlowy, returns empty).
 */
export async function getDatabaseSchema(databaseId: string): Promise<DatabaseSchema | null> {
  // AppFlowy doesn't have a schema concept like Notion databases
  return null;
}
