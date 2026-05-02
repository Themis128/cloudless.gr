/**
 * Notion persistence for the content calendar.
 *
 * Expected Notion database schema (NOTION_CALENDAR_DB_ID):
 * ┌──────────────┬────────────────────────────────────────────────────────┐
 * │ Column       │ Type                                                   │
 * ├──────────────┼────────────────────────────────────────────────────────┤
 * │ Name         │ Title                                                  │
 * │ CalID        │ Rich text  (internal ID, e.g. "cal_1234567_abc")       │
 * │ Type         │ Select (social_post | email_campaign | blog_post | ...) │
 * │ Platform     │ Select (meta | linkedin | tiktok | x | google | ...)   │
 * │ Date         │ Date (start + optional end)                            │
 * │ Status       │ Select (draft | scheduled | published | cancelled)     │
 * │ URL          │ URL                                                    │
 * │ Notes        │ Rich text                                              │
 * └──────────────┴────────────────────────────────────────────────────────┘
 */

import { notionFetch } from "@/lib/notion";
import {
  IntegrationNotConfiguredError,
  requireIntegrationAsync,
} from "@/lib/integrations";
import type { CalendarItem } from "@/lib/content-calendar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getDb(): Promise<{ apiKey: string; dbId: string }> {
  // Empty string means explicitly disabled -- don't let SSM override a cleared env var.
  if (
    process.env.NOTION_API_KEY === "" ||
    process.env.NOTION_CALENDAR_DB_ID === ""
  ) {
    throw new IntegrationNotConfiguredError([
      "NOTION_API_KEY",
      "NOTION_CALENDAR_DB_ID",
    ]);
  }
  const cfg = await requireIntegrationAsync(
    "NOTION_API_KEY",
    "NOTION_CALENDAR_DB_ID",
  );
  return { apiKey: cfg.NOTION_API_KEY!, dbId: cfg.NOTION_CALENDAR_DB_ID! };
}

function rt(text: string) {
  return [{ text: { content: text.slice(0, 2000) } }];
}

function pageToItem(page: Record<string, unknown>): CalendarItem | null {
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

    function dateField(key: string): { start?: string; end?: string } {
      const prop = p[key] as
        | { date?: { start?: string; end?: string | null } }
        | undefined;
      return { start: prop?.date?.start, end: prop?.date?.end ?? undefined };
    }

    function urlField(key: string): string | undefined {
      const prop = p[key] as { url?: string | null } | undefined;
      return prop?.url ?? undefined;
    }

    const dateRange = dateField("Date");
    const calId = richText("CalID");

    return {
      id: calId || (page as { id: string }).id,
      title: title(),
      type: sel("Type") as CalendarItem["type"],
      platform: sel("Platform") as CalendarItem["platform"],
      date: dateRange.start ?? "",
      endDate: dateRange.end,
      status: sel("Status") as CalendarItem["status"],
      url: urlField("URL"),
      notes: richText("Notes") || undefined,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function notionGetCalendarItems(
  from?: string,
  to?: string,
): Promise<CalendarItem[] | null> {
  const db = await getDb();

  const filter: Record<string, unknown>[] = [];
  if (from) {
    filter.push({ property: "Date", date: { on_or_after: from } });
  }
  if (to) {
    filter.push({ property: "Date", date: { on_or_before: to } });
  }

  const body: Record<string, unknown> = {
    sorts: [{ property: "Date", direction: "ascending" }],
  };
  if (filter.length === 1) {
    body.filter = filter[0];
  } else if (filter.length > 1) {
    body.filter = { and: filter };
  }

  try {
    const res = await notionFetch<{ results: unknown[] }>(
      `/databases/${db.dbId}/query`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );

    return res.results
      .map((p) => pageToItem(p as Record<string, unknown>))
      .filter((item): item is CalendarItem => item !== null);
  } catch {
    return null;
  }
}

export async function notionCreateCalendarItem(
  item: CalendarItem,
): Promise<string | null> {
  const db = await getDb();

  const properties: Record<string, unknown> = {
    Name: { title: rt(item.title) },
    CalID: { rich_text: rt(item.id) },
    Type: { select: { name: item.type } },
    Platform: { select: { name: item.platform } },
    Date: {
      date: {
        start: item.date,
        end: item.endDate ?? null,
      },
    },
    Status: { select: { name: item.status } },
  };

  if (item.url) properties.URL = { url: item.url };
  if (item.notes) properties.Notes = { rich_text: rt(item.notes) };

  try {
    const page = await notionFetch<{ id: string }>("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: db.dbId },
        properties,
      }),
    });
    return page.id;
  } catch {
    return null;
  }
}

export async function notionUpdateCalendarItem(
  item: CalendarItem,
): Promise<boolean> {
  const db = await getDb();

  // Find the Notion page by CalID
  try {
    const search = await notionFetch<{ results: { id: string }[] }>(
      `/databases/${db.dbId}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          filter: { property: "CalID", rich_text: { equals: item.id } },
          page_size: 1,
        }),
      },
    );

    const pageId = search.results[0]?.id;
    if (!pageId) return false;

    const properties: Record<string, unknown> = {
      Name: { title: rt(item.title) },
      Type: { select: { name: item.type } },
      Platform: { select: { name: item.platform } },
      Date: { date: { start: item.date, end: item.endDate ?? null } },
      Status: { select: { name: item.status } },
      URL: item.url ? { url: item.url } : { url: null },
      Notes: { rich_text: item.notes ? rt(item.notes) : [] },
    };

    await notionFetch(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function notionDeleteCalendarItem(id: string): Promise<boolean> {
  const db = await getDb();

  try {
    const search = await notionFetch<{ results: { id: string }[] }>(
      `/databases/${db.dbId}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          filter: { property: "CalID", rich_text: { equals: id } },
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
