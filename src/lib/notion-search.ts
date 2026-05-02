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

import { notionFetch } from "@/lib/notion";
import { requireIntegrationAsync } from "@/lib/integrations";

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

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapSearchResult(item: any): SearchResult {
  const isPage = item.object === "page";
  let title = "";

  if (isPage) {
    const props = item.properties ?? {};
    // Try common title property names
    const titleProp =
      props.Title?.title ?? props.Name?.title ?? props.title?.title;
    title = titleProp ? titleProp.map((t: any) => t.plain_text).join("") : "";
  } else {
    // Database title
    title = (item.title ?? []).map((t: any) => t.plain_text).join("");
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

function mapUser(user: any): NotionUser {
  return {
    id: user.id,
    name: user.name ?? "",
    email: user.person?.email ?? user.bot?.owner?.user?.person?.email ?? "",
    avatarUrl: user.avatar_url ?? "",
    type: user.type as "person" | "bot",
  };
}

function mapProperty(name: string, prop: any): DatabaseProperty {
  const result: DatabaseProperty = {
    name,
    type: prop.type ?? "unknown",
    id: prop.id ?? "",
  };

  // Extract options for select/multi_select
  if (prop.select?.options) {
    result.options = prop.select.options.map((o: any) => ({
      name: o.name,
      color: o.color,
    }));
  }
  if (prop.multi_select?.options) {
    result.options = prop.multi_select.options.map((o: any) => ({
      name: o.name,
      color: o.color,
    }));
  }
  if (prop.status?.options) {
    result.options = prop.status.options.map((o: any) => ({
      name: o.name,
      color: o.color,
    }));
  }

  return result;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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
  await requireIntegrationAsync("NOTION_API_KEY");

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const body: Record<string, any> = {
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
      results: any[];
      has_more: boolean;
      next_cursor?: string;
    }>("/search", {
      method: "POST",
      body: JSON.stringify(body),
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

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
  await requireIntegrationAsync("NOTION_API_KEY");

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const data = await notionFetch<{ results: any[] }>("/users", {
      method: "GET",
    });
    return data.results.map(mapUser);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch (err) {
    console.error("[Notion Users] Failed to list users:", err);
    return [];
  }
}

/**
 * Get the bot user (the integration itself).
 */
export async function getBotUser(): Promise<NotionUser | null> {
  await requireIntegrationAsync("NOTION_API_KEY");

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const data = await notionFetch<any>("/users/me");
    return mapUser(data);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch (err) {
    console.error("[Notion Users] Failed to get bot user:", err);
    return null;
  }
}

/**
 * Get a specific user by ID.
 */
export async function getUser(userId: string): Promise<NotionUser | null> {
  await requireIntegrationAsync("NOTION_API_KEY");

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const data = await notionFetch<any>(`/users/${userId}`);
    return mapUser(data);
    /* eslint-enable @typescript-eslint/no-explicit-any */
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
  await requireIntegrationAsync("NOTION_API_KEY");

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const db = await notionFetch<any>(`/databases/${databaseId}`);

    const title = (db.title ?? []).map((t: any) => t.plain_text).join("");
    const properties: DatabaseProperty[] = Object.entries(
      db.properties ?? {},
    ).map(([name, prop]) => mapProperty(name, prop));

    return {
      id: db.id,
      title,
      properties,
      url: db.url ?? "",
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
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
