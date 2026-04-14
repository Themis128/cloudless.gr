/**
 * Notion Search, Users & Database Schema utilities.
 *
 * Provides cross-workspace search, user management, and database
 * introspection features based on the Notion REST API.
 *
 * Skills used:
 *   - notion-search-users (Search API, user endpoints)
 *   - notion-database-management (schema retrieval)
 *   - notion-wikis (discoverability patterns)
 */

import { notionFetch, notionFetchAll, extractText } from "@/lib/notion";
import { isConfigured } from "@/lib/integrations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string;
  type: "page" | "database";
  title: string;
  url: string;
  lastEditedTime: string;
  parentType: string;
  parentId: string;
  icon?: string;
}

export interface NotionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  type: "person" | "bot";
}

export interface DatabaseSchema {
  id: string;
  title: string;
  properties: DatabaseProperty[];
  url: string;
}

export interface DatabaseProperty {
  name: string;
  type: string;
  id: string;
  options?: { name: string; color?: string }[];
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

interface RichTextItem { plain_text: string }
interface NotionIcon { emoji?: string; external?: { url?: string } }
interface NotionParent { type?: string; page_id?: string; database_id?: string; workspace_id?: string }
interface NotionSearchItem {
  id: string;
  object: string;
  url?: string;
  last_edited_time?: string;
  parent?: NotionParent;
  icon?: NotionIcon;
  title?: RichTextItem[];
  properties?: Record<string, { title?: RichTextItem[]; [key: string]: unknown }>;
}
interface NotionUserRaw {
  id: string;
  name?: string;
  avatar_url?: string;
  type?: string;
  person?: { email?: string };
  bot?: { owner?: { user?: { person?: { email?: string } } } };
}
interface NotionPropertyRaw {
  type?: string;
  id?: string;
  select?: { options?: Array<{ name: string; color?: string }> };
  multi_select?: { options?: Array<{ name: string; color?: string }> };
  status?: { options?: Array<{ name: string; color?: string }> };
}
interface NotionDatabaseRaw {
  id: string;
  url?: string;
  title?: RichTextItem[];
  properties?: Record<string, NotionPropertyRaw>;
}

function mapSearchResult(item: NotionSearchItem): SearchResult {
  const isPage = item.object === "page";
  let title = "";

  if (isPage) {
    const props = item.properties ?? {};
    const titleProp = props.Title?.title ?? props.Name?.title ?? props.title?.title;
    title = titleProp ? titleProp.map((t) => t.plain_text).join("") : "";
  } else {
    title = (item.title ?? []).map((t) => t.plain_text).join("");
  }

  return {
    id: item.id,
    type: item.object as "page" | "database",
    title,
    url: item.url ?? "",
    lastEditedTime: item.last_edited_time ?? "",
    parentType: item.parent?.type ?? "",
    parentId:
      item.parent?.page_id ??
      item.parent?.database_id ??
      item.parent?.workspace_id ??
      "",
    icon: item.icon?.emoji ?? item.icon?.external?.url ?? undefined,
  };
}

function mapUser(user: NotionUserRaw): NotionUser {
  return {
    id: user.id,
    name: user.name ?? "",
    email: user.person?.email ?? user.bot?.owner?.user?.person?.email ?? "",
    avatarUrl: user.avatar_url ?? "",
    type: (user.type ?? "person") as "person" | "bot",
  };
}

function mapProperty(name: string, prop: NotionPropertyRaw): DatabaseProperty {
  const result: DatabaseProperty = {
    name,
    type: prop.type ?? "unknown",
    id: prop.id ?? "",
  };

  if (prop.select?.options) {
    result.options = prop.select.options.map((o) => ({ name: o.name, color: o.color }));
  }
  if (prop.multi_select?.options) {
    result.options = prop.multi_select.options.map((o) => ({ name: o.name, color: o.color }));
  }
  if (prop.status?.options) {
    result.options = prop.status.options.map((o) => ({ name: o.name, color: o.color }));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Search API
// ---------------------------------------------------------------------------

/**
 * Search across all Notion pages and databases the integration can access.
 * Supports filtering by type and pagination.
 */
export async function searchPages(
  query: string,
  options?: {
    filter?: "page" | "database";
    limit?: number;
    sortDirection?: "ascending" | "descending";
    startCursor?: string;
  },
): Promise<{ results: SearchResult[]; hasMore: boolean; nextCursor?: string }> {
  if (!isConfigured("NOTION_API_KEY")) {
    return { results: [], hasMore: false };
  }

  try {
    const body: Record<string, unknown> = {
      query,
      page_size: Math.min(options?.limit ?? 20, 100),
      sort: {
        direction: options?.sortDirection ?? "descending",
        timestamp: "last_edited_time",
      },
    };

    if (options?.filter) {
      body.filter = { value: options.filter, property: "object" };
    }
    if (options?.startCursor) {
      body.start_cursor = options.startCursor;
    }

    const data = await notionFetch<{
      results: NotionSearchItem[];
      has_more: boolean;
      next_cursor?: string;
    }>("/search", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      results: data.results.map(mapSearchResult),
      hasMore: data.has_more,
      nextCursor: data.next_cursor ?? undefined,
    };
  } catch (err) {
    console.error("[Notion Search] Failed to search:", err);
    return { results: [], hasMore: false };
  }
}

/**
 * Search only databases.
 */
export async function searchDatabases(
  query: string,
  limit = 20,
): Promise<SearchResult[]> {
  const { results } = await searchPages(query, { filter: "database", limit });
  return results;
}

// ---------------------------------------------------------------------------
// Users API
// ---------------------------------------------------------------------------

/**
 * List all users in the workspace.
 */
export async function listUsers(): Promise<NotionUser[]> {
  if (!isConfigured("NOTION_API_KEY")) return [];

  try {
    const data = await notionFetch<{ results: NotionUserRaw[] }>("/users", {
      method: "GET",
    });
    return data.results.map(mapUser);
  } catch (err) {
    console.error("[Notion Users] Failed to list users:", err);
    return [];
  }
}

/**
 * Get the bot user (the integration itself).
 */
export async function getBotUser(): Promise<NotionUser | null> {
  if (!isConfigured("NOTION_API_KEY")) return null;

  try {
    const data = await notionFetch<NotionUserRaw>("/users/me");
    return mapUser(data);
  } catch (err) {
    console.error("[Notion Users] Failed to get bot user:", err);
    return null;
  }
}

/**
 * Get a specific user by ID.
 */
export async function getUser(userId: string): Promise<NotionUser | null> {
  if (!isConfigured("NOTION_API_KEY")) return null;

  try {
    const data = await notionFetch<NotionUserRaw>(`/users/${userId}`);
    return mapUser(data);
  } catch (err) {
    console.error("[Notion Users] Failed to get user:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Database Schema API
// ---------------------------------------------------------------------------

/**
 * Retrieve the full schema of a database — property names, types, and options.
 * Useful for building dynamic forms or admin UIs.
 */
export async function getDatabaseSchema(
  databaseId: string,
): Promise<DatabaseSchema | null> {
  if (!isConfigured("NOTION_API_KEY")) return null;

  try {
    const db = await notionFetch<NotionDatabaseRaw>(`/databases/${databaseId}`);

    const title = (db.title ?? []).map((t) => t.plain_text).join("");
    const properties: DatabaseProperty[] = Object.entries(db.properties ?? {}).map(
      ([name, prop]) => mapProperty(name, prop),
    );

    return {
      id: db.id,
      title,
      properties,
      url: db.url ?? "",
    };
  } catch (err) {
    console.error("[Notion Schema] Failed to get database schema:", err);
    return null;
  }
}

/**
 * Get all available select/multi-select options for a property.
 * Useful for building filter dropdowns in the UI.
 */
export async function getPropertyOptions(
  databaseId: string,
  propertyName: string,
): Promise<{ name: string; color?: string }[]> {
  const schema = await getDatabaseSchema(databaseId);
  if (!schema) return [];

  const prop = schema.properties.find((p) => p.name === propertyName);
  return prop?.options ?? [];
}
