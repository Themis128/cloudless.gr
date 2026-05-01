/**
 * Notion Analytics — tracks site events and generates rollup summaries.
 *
 * Two-way: the site writes events TO Notion, and reads aggregated data
 * FROM Notion for the admin dashboard.
 *
 * DB ID: NOTION_ANALYTICS_DB_ID (cc4287fcb42a42dc92a7053d6f1199c7)
 */

import { notionFetch, notionFetchAll, extractText } from "@/lib/notion";
import { getIntegrationsAsync, isConfiguredAsync } from "@/lib/integrations";

const isAnalyticsConfigured = () =>
  isConfiguredAsync("NOTION_API_KEY", "NOTION_ANALYTICS_DB_ID");

const EVENT_PAGE_VIEW = "page_view";
const EVENT_BLOG_VIEW = "blog_view";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnalyticsEventType = // NOSONAR — type annotation
  | "page_view" // NOSONAR
  | "form_submit"
  | "blog_view" // NOSONAR
  | "doc_view"
  | "signup"
  | "order"
  | "error"
  | "weekly_rollup";

export interface AnalyticsEvent {
  id: string;
  event: string;
  type: AnalyticsEventType;
  page: string;
  source: string;
  count: number;
  date: string;
  country: string;
  metadata: string;
}

export interface AnalyticsSummary {
  totalEvents: number;
  byType: Record<string, number>;
  topPages: { page: string; count: number }[];
  topSources: { source: string; count: number }[];
  recentEvents: AnalyticsEvent[];
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapEvent(page: any): AnalyticsEvent {
  const p = page.properties ?? {};
  return {
    id: page.id,
    event: extractText(p.Event?.title),
    type: (p.Type?.select?.name ?? EVENT_PAGE_VIEW) as AnalyticsEventType,
    page: extractText(p.Page?.rich_text),
    source: extractText(p.Source?.rich_text),
    count: p.Count?.number ?? 1,
    date: p.Date?.date?.start ?? page.created_time ?? "",
    country: extractText(p.Country?.rich_text),
    metadata: extractText(p.Metadata?.rich_text),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Write — Track events (with queue-based batching to stay under 3 req/s)
// ---------------------------------------------------------------------------

type EventData = Parameters<typeof trackEvent>[0];

const writeQueue: EventData[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_THRESHOLD = 10;
const FLUSH_DELAY_MS = 5000;

async function writeEventToNotion(data: EventData): Promise<string | null> {
  if (!(await isAnalyticsConfigured()))
    return null;

  const { NOTION_ANALYTICS_DB_ID } = await getIntegrationsAsync();
  try {
    const page = await notionFetch<{ id: string }>("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: NOTION_ANALYTICS_DB_ID },
        properties: {
          Event: { title: [{ text: { content: data.event.slice(0, 200) } }] },
          Type: { select: { name: data.type } },
          ...(data.page
            ? { Page: { rich_text: [{ text: { content: data.page } }] } }
            : {}),
          ...(data.source
            ? { Source: { rich_text: [{ text: { content: data.source } }] } }
            : {}),
          Count: { number: data.count ?? 1 },
          Date: { date: { start: new Date().toISOString() } },
          ...(data.country
            ? { Country: { rich_text: [{ text: { content: data.country } }] } }
            : {}),
          ...(data.metadata
            ? {
                Metadata: {
                  rich_text: [
                    {
                      text: {
                        content: JSON.stringify(data.metadata).slice(0, 2000),
                      },
                    },
                  ],
                },
              }
            : {}),
        },
      }),
    });
    return page.id;
  } catch (err) {
    console.error("[Notion Analytics] Failed to track event:", err);
    return null;
  }
}

/** Clear the pending event queue without writing — for use in tests only. */
export function resetEventQueue(): void {
  writeQueue.splice(0);
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

/**
 * Flush the pending event queue — writes each event to Notion sequentially.
 * Called automatically when the queue reaches FLUSH_THRESHOLD or after FLUSH_DELAY_MS.
 */
export async function flushEventQueue(): Promise<{
  written: number;
  errors: number;
}> {
  const events = writeQueue.splice(0);
  if (!events.length) return { written: 0, errors: 0 };
  let written = 0;
  let errors = 0;
  for (const event of events) {
    const id = await writeEventToNotion(event);
    if (id) written++;
    else errors++;
  }
  return { written, errors };
}

/**
 * Track an analytics event in Notion.
 * By default queues the write and batches flushes to avoid hitting 3 req/s.
 * Pass `{ immediate: true }` to bypass the queue (e.g. for weekly rollups).
 */
export async function trackEvent(
  data: {
    event: string;
    type: AnalyticsEventType;
    page?: string;
    source?: string;
    count?: number;
    country?: string;
    metadata?: Record<string, unknown>;
  },
  opts?: { immediate?: boolean },
): Promise<string | null> {
  if (opts?.immediate) return writeEventToNotion(data);

  writeQueue.push(data);

  if (writeQueue.length >= FLUSH_THRESHOLD) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flushEventQueue();
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushEventQueue();
    }, FLUSH_DELAY_MS);
  }

  return null;
}

/**
 * Convenience: track a form submission event.
 */
export async function trackFormSubmission(
  formName: string,
  source?: string,
): Promise<string | null> {
  return trackEvent(
    {
      event: `Form: ${formName}`,
      type: "form_submit",
      page: `/contact`,
      source,
    },
    { immediate: true },
  );
}

/**
 * Convenience: track a blog post view.
 */
export async function trackBlogView(
  slug: string,
  source?: string,
): Promise<string | null> {
  return trackEvent(
    {
      event: `Blog: ${slug}`,
      type: EVENT_BLOG_VIEW,
      page: `/blog/${slug}`,
      source,
    },
    { immediate: true },
  );
}

// ---------------------------------------------------------------------------
// Read — Query analytics
// ---------------------------------------------------------------------------

/**
 * Fetch recent analytics events, optionally filtered by type.
 */
export async function getRecentEvents(
  type?: AnalyticsEventType,
  limit = 50,
): Promise<AnalyticsEvent[]> {
  if (!(await isAnalyticsConfigured()))
    return [];

  const { NOTION_ANALYTICS_DB_ID } = await getIntegrationsAsync();
  try {
    const filter = type
      ? { property: "Type", select: { equals: type } }
      : undefined;

    const pages = await notionFetchAll(
      `/databases/${NOTION_ANALYTICS_DB_ID}/query`,
      {
        ...(filter ? { filter } : {}),
        sorts: [{ property: "Date", direction: "descending" }],
        page_size: Math.min(limit, 100),
      },
    );
    return pages.slice(0, limit).map(mapEvent);
  } catch (err) {
    console.error("[Notion Analytics] Failed to fetch events:", err);
    return [];
  }
}

/**
 * Get events from a specific date range.
 */
export async function getEventsByDateRange(
  startDate: string,
  endDate: string,
): Promise<AnalyticsEvent[]> {
  if (!(await isAnalyticsConfigured()))
    return [];

  const { NOTION_ANALYTICS_DB_ID } = await getIntegrationsAsync();
  try {
    const pages = await notionFetchAll(
      `/databases/${NOTION_ANALYTICS_DB_ID}/query`,
      {
        filter: {
          and: [
            { property: "Date", date: { on_or_after: startDate } },
            { property: "Date", date: { on_or_before: endDate } },
          ],
        },
        sorts: [{ property: "Date", direction: "descending" }],
      },
    );
    return pages.map(mapEvent);
  } catch (err) {
    console.error("[Notion Analytics] Failed to fetch events by date:", err);
    return [];
  }
}

/**
 * Generate a summary of analytics data for the admin dashboard.
 */
export async function getAnalyticsSummary(days = 7): Promise<AnalyticsSummary> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const events = await getEventsByDateRange(
    startDate.toISOString().split("T")[0],
    new Date().toISOString().split("T")[0],
  );

  // Aggregate by type
  const byType: Record<string, number> = {};
  for (const e of events) {
    byType[e.type] = (byType[e.type] ?? 0) + e.count;
  }

  // Top pages
  const pageMap: Record<string, number> = {};
  for (const e of events) {
    if (e.page) pageMap[e.page] = (pageMap[e.page] ?? 0) + e.count;
  }
  const topPages = Object.entries(pageMap)
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top sources
  const sourceMap: Record<string, number> = {};
  for (const e of events) {
    if (e.source) sourceMap[e.source] = (sourceMap[e.source] ?? 0) + e.count;
  }
  const topSources = Object.entries(sourceMap)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalEvents: events.reduce((sum, e) => sum + e.count, 0),
    byType,
    topPages,
    topSources,
    recentEvents: events.slice(0, 20),
  };
}

/**
 * Archive (delete) granular analytics events older than `daysToKeep`.
 *
 * The idea: once a weekly_rollup has been created, the individual
 * page_view / blog_view / doc_view rows are redundant. This function
 * archives them by moving the Notion pages to trash.
 *
 * Call this after `createWeeklyRollup()` (e.g. in a cron/Make scenario).
 *
 * Only deletes granular event types — keeps form_submit, signup, order,
 * error, and weekly_rollup rows permanently.
 */
export async function archiveOldEvents(
  daysToKeep = 30,
): Promise<{ archived: number; errors: number }> {
  if (!(await isAnalyticsConfigured()))
    return { archived: 0, errors: 0 };

  const { NOTION_ANALYTICS_DB_ID } = await getIntegrationsAsync();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  // Only archive high-volume granular events
  const archivableTypes = [EVENT_PAGE_VIEW, EVENT_BLOG_VIEW, "doc_view"];

  let archived = 0;
  let errors = 0;

  for (const eventType of archivableTypes) {
    try {
      const pages = await notionFetchAll(
        `/databases/${NOTION_ANALYTICS_DB_ID}/query`,
        {
          filter: {
            and: [
              { property: "Type", select: { equals: eventType } },
              { property: "Date", date: { before: cutoffStr } },
            ],
          },
        },
      );

      for (const page of pages) {
        try {
          await notionFetch(`/pages/${(page as { id: string }).id}`, {
            method: "PATCH",
            body: JSON.stringify({ archived: true }),
          });
          archived++;
        } catch {
          errors++;
        }
      }
    } catch (err) {
      console.error(
        `[Notion Analytics] Failed to archive ${eventType} events:`,
        err,
      );
      errors++;
    }
  }

  console.warn(
    `[Notion Analytics] Archived ${archived} old events (${errors} errors)`,
  );
  return { archived, errors };
}

/**
 * Create a weekly rollup entry summarizing the past 7 days.
 * Called by scheduled automation.
 */
export async function createWeeklyRollup(): Promise<string | null> {
  const summary = await getAnalyticsSummary(7);
  const metadata = {
    byType: summary.byType,
    topPages: summary.topPages.slice(0, 5),
    topSources: summary.topSources.slice(0, 5),
  };

  return trackEvent(
    {
      event: `Weekly Rollup — ${new Date().toISOString().split("T")[0]}`,
      type: "weekly_rollup",
      count: summary.totalEvents,
      metadata,
    },
    { immediate: true },
  );
}
