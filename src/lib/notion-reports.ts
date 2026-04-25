/**
 * Notion persistence for client reports.
 *
 * Expected Notion database schema (NOTION_REPORTS_DB_ID):
 * ┌──────────────┬─────────────────────────────────────────────────────────┐
 * │ Column       │ Type                                                    │
 * ├──────────────┼─────────────────────────────────────────────────────────┤
 * │ Name         │ Title  (client name)                                    │
 * │ ReportID     │ Rich text  (internal ID)                                │
 * │ Status       │ Select (generating | ready | error)                     │
 * │ DateStart    │ Date                                                    │
 * │ DateEnd      │ Rich text                                               │
 * │ Sections     │ Rich text  (JSON, capped at 2000 chars)                 │
 * │ CreatedAt    │ Date                                                    │
 * └──────────────┴─────────────────────────────────────────────────────────┘
 */

import { notionFetch } from "@/lib/notion";
import { getIntegrationsAsync } from "@/lib/integrations";
import type { Report } from "@/lib/reports";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getDb(): Promise<{ apiKey: string; dbId: string } | null> {
  // Fast-path: respect explicit env-var clears immediately (bypasses stale async cache).
  // Mirrors the same guard in isConfiguredAsync().
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_REPORTS_DB_ID)
    return null;
  const cfg = await getIntegrationsAsync();
  if (!cfg.NOTION_API_KEY || !cfg.NOTION_REPORTS_DB_ID) return null;
  return { apiKey: cfg.NOTION_API_KEY, dbId: cfg.NOTION_REPORTS_DB_ID };
}

function rt(text: string) {
  return [{ text: { content: text.slice(0, 2000) } }];
}

function pageToReport(page: Record<string, unknown>): Report | null {
  try {
    const p =
      (page as { properties: Record<string, unknown> }).properties ?? {};

    function sel(key: string): string {
      const prop = p[key] as { select?: { name?: string } } | undefined;
      return prop?.select?.name ?? "";
    }

    function richText(key: string): string {
      const prop = p[key] as
        | { rich_text?: { plain_text?: string }[] }
        | undefined;
      return prop?.rich_text?.map((r) => r.plain_text ?? "").join("") ?? "";
    }

    function title(): string {
      const prop = p["Name"] as
        | { title?: { plain_text?: string }[] }
        | undefined;
      return prop?.title?.map((r) => r.plain_text ?? "").join("") ?? "";
    }

    function dateField(key: string): string {
      const prop = p[key] as { date?: { start?: string } } | undefined;
      return prop?.date?.start ?? "";
    }

    let sections: Report["sections"] = [];
    try {
      sections = JSON.parse(richText("Sections") || "[]");
    } catch {
      /* ignore */
    }

    return {
      id: richText("ReportID") || (page as { id: string }).id,
      clientName: title(),
      status: sel("Status") as Report["status"],
      dateRange: {
        start: dateField("DateStart"),
        end: richText("DateEnd"),
      },
      sections,
      createdAt: dateField("CreatedAt") || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function notionListReports(): Promise<Report[] | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const res = await notionFetch<{ results: unknown[] }>(
      `/databases/${db.dbId}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          sorts: [{ property: "CreatedAt", direction: "descending" }],
        }),
      },
    );

    return res.results
      .map((p) => pageToReport(p as Record<string, unknown>))
      .filter((r): r is Report => r !== null);
  } catch {
    return null;
  }
}

export async function notionGetReport(id: string): Promise<Report | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const res = await notionFetch<{ results: unknown[] }>(
      `/databases/${db.dbId}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          filter: { property: "ReportID", rich_text: { equals: id } },
          page_size: 1,
        }),
      },
    );

    const page = res.results[0];
    if (!page) return null;
    return pageToReport(page as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function notionCreateReport(
  report: Report,
): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const page = await notionFetch<{ id: string }>("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: db.dbId },
        properties: {
          Name: { title: rt(report.clientName) },
          ReportID: { rich_text: rt(report.id) },
          Status: { select: { name: report.status } },
          DateStart: { date: { start: report.dateRange.start } },
          DateEnd: { rich_text: rt(report.dateRange.end) },
          Sections: { rich_text: rt(JSON.stringify(report.sections)) },
          CreatedAt: { date: { start: report.createdAt } },
        },
      }),
    });
    return page.id;
  } catch {
    return null;
  }
}

export async function notionUpdateReport(
  id: string,
  updates: Partial<Report>,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const search = await notionFetch<{ results: { id: string }[] }>(
      `/databases/${db.dbId}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          filter: { property: "ReportID", rich_text: { equals: id } },
          page_size: 1,
        }),
      },
    );

    const pageId = search.results[0]?.id;
    if (!pageId) return false;

    const properties: Record<string, unknown> = {};
    if (updates.status)
      properties.Status = { select: { name: updates.status } };
    if (updates.sections !== undefined) {
      properties.Sections = { rich_text: rt(JSON.stringify(updates.sections)) };
    }
    if (updates.clientName) properties.Name = { title: rt(updates.clientName) };

    await notionFetch(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function notionDeleteReport(id: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const search = await notionFetch<{ results: { id: string }[] }>(
      `/databases/${db.dbId}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          filter: { property: "ReportID", rich_text: { equals: id } },
          page_size: 1,
        }),
      },
    );

    const pageId = search.results[0]?.id;
    if (!pageId) return false;

    await notionFetch(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    });
    return true;
  } catch {
    return false;
  }
}
