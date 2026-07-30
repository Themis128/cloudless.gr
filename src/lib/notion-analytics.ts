/**
 * Notion Analytics — DECOMMISSIONED 2026-06-20; reads route to D1.
 *
 * The Notion `NOTION_ANALYTICS_DB_ID` database was decommissioned in PR #1044.
 * Read paths query D1 `analytics_events` (migration 0009) when AUTH_DB is bound.
 *
 * Write paths (trackEvent / trackBlogView / trackFormSubmission) remain
 * no-ops because emission already happens via Plausible + D1 track API, NOT
 * through this module.
 *
 * Outside-of-D1 contexts (local dev without AUTH_DB): every function returns
 * empty data so callers don't crash.
 */

import { getAuthDbFromEnv, type AuthDatabase } from "@/lib/auth-d1";

// ---------------------------------------------------------------------------
// Types — kept verbatim for caller compatibility
// ---------------------------------------------------------------------------

export type AnalyticsEventType =
  | "page_view"
  | "form_submit"
  | "blog_view"
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

const EMPTY_SUMMARY: AnalyticsSummary = {
  totalEvents: 0,
  byType: {},
  topPages: [],
  topSources: [],
  recentEvents: [],
};

type EventRow = {
  id: string;
  event: string;
  page: string | null;
  source: string | null;
  properties_json: string | null;
  created_at: number;
};

function rowToEvent(r: EventRow): AnalyticsEvent {
  return {
    id: String(r.id),
    event: String(r.event ?? ""),
    type: (r.event ?? "page_view") as AnalyticsEventType,
    page: String(r.page ?? ""),
    source: String(r.source ?? ""),
    count: 1,
    date: new Date(r.created_at * 1000).toISOString(),
    country: "",
    metadata: String(r.properties_json ?? ""),
  };
}

function daysAgoUnix(days: number): number {
  return Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
}

async function safeD1<T>(
  label: string,
  fallback: T,
  fn: (db: AuthDatabase) => Promise<T>
): Promise<T> {
  const db = getAuthDbFromEnv();
  if (!db) return fallback;
  return fn(db).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[notion-analytics] D1 ${label} failed:`, msg);
    return fallback;
  });
}

// ---------------------------------------------------------------------------
// Write paths — no-op (data flows via track API + D1, not here)
// ---------------------------------------------------------------------------

export function resetEventQueue(): void {
  // intentional no-op
}

export async function flushEventQueue(): Promise<{ written: number; errors: number }> {
  return { written: 0, errors: 0 };
}

export async function trackEvent(
  _data: {
    event: string;
    type: AnalyticsEventType;
    page?: string;
    source?: string;
    count?: number;
    country?: string;
    metadata?: Record<string, unknown>;
  },
  _opts?: { immediate?: boolean }
): Promise<string | null> {
  return null;
}

export async function trackFormSubmission(
  _formName: string,
  _source?: string
): Promise<string | null> {
  return null;
}

export async function trackBlogView(_slug: string, _source?: string): Promise<string | null> {
  return null;
}

// ---------------------------------------------------------------------------
// Read paths — D1-backed
// ---------------------------------------------------------------------------

/** Recent events from D1 analytics_events. Optional event-type filter. */
export async function getRecentEvents(
  filterOrLimit?: AnalyticsEventType | number,
  limit = 50
): Promise<AnalyticsEvent[]> {
  const typeFilter = typeof filterOrLimit === "string" ? filterOrLimit : null;
  const cap = typeof filterOrLimit === "number" ? filterOrLimit : Math.max(1, Math.min(limit, 500));

  return safeD1("getRecentEvents", [], async (db) => {
    const sql = typeFilter
      ? `SELECT id, event, page, source, properties_json, created_at
         FROM analytics_events WHERE event = ?
         ORDER BY created_at DESC LIMIT ?`
      : `SELECT id, event, page, source, properties_json, created_at
         FROM analytics_events
         ORDER BY created_at DESC LIMIT ?`;
    const stmt = db.prepare(sql);
    const result = typeFilter
      ? await stmt.bind(typeFilter, cap).all<EventRow>()
      : await stmt.bind(cap).all<EventRow>();
    return (result.results ?? []).map(rowToEvent);
  });
}

export async function getEventsByDateRange(
  startISO: string,
  endISO: string
): Promise<AnalyticsEvent[]> {
  const startUnix = Math.floor(new Date(startISO).getTime() / 1000);
  const endUnix = Math.floor(new Date(endISO).getTime() / 1000);
  if (!Number.isFinite(startUnix) || !Number.isFinite(endUnix)) return [];

  return safeD1("getEventsByDateRange", [], async (db) => {
    const result = await db
      .prepare(
        `SELECT id, event, page, source, properties_json, created_at
         FROM analytics_events
         WHERE created_at >= ? AND created_at < ?
         ORDER BY created_at DESC
         LIMIT 1000`
      )
      .bind(startUnix, endUnix)
      .all<EventRow>();
    return (result.results ?? []).map(rowToEvent);
  });
}

export async function getAnalyticsSummary(days = 7): Promise<AnalyticsSummary> {
  const cap = Math.max(1, Math.min(days, 365));
  const since = daysAgoUnix(cap);

  const summary = await safeD1("getAnalyticsSummary", EMPTY_SUMMARY, async (db) => {
    const totalResult = await db
      .prepare(`SELECT COUNT(*) AS n FROM analytics_events WHERE created_at >= ?`)
      .bind(since)
      .first<{ n: number }>();

    const typeResult = await db
      .prepare(
        `SELECT event AS k, COUNT(*) AS n
         FROM analytics_events WHERE created_at >= ?
         GROUP BY event`
      )
      .bind(since)
      .all<{ k: string; n: number }>();

    const pageResult = await db
      .prepare(
        `SELECT page AS k, COUNT(*) AS n
         FROM analytics_events
         WHERE created_at >= ? AND page IS NOT NULL AND page <> ''
         GROUP BY page
         ORDER BY n DESC
         LIMIT 10`
      )
      .bind(since)
      .all<{ k: string; n: number }>();

    const sourceResult = await db
      .prepare(
        `SELECT source AS k, COUNT(*) AS n
         FROM analytics_events
         WHERE created_at >= ? AND source IS NOT NULL AND source <> ''
         GROUP BY source
         ORDER BY n DESC
         LIMIT 10`
      )
      .bind(since)
      .all<{ k: string; n: number }>();

    const out: AnalyticsSummary = {
      totalEvents: Number(totalResult?.n ?? 0),
      byType: {},
      topPages: [],
      topSources: [],
      recentEvents: [],
    };

    for (const r of typeResult.results ?? []) {
      if (r.k) out.byType[r.k] = Number(r.n ?? 0);
    }
    for (const r of pageResult.results ?? []) {
      if (r.k) out.topPages.push({ page: r.k, count: Number(r.n ?? 0) });
    }
    for (const r of sourceResult.results ?? []) {
      if (r.k) out.topSources.push({ source: r.k, count: Number(r.n ?? 0) });
    }

    return out;
  });

  summary.recentEvents = await getRecentEvents(10);
  return summary;
}

export async function archiveOldEvents(
  _olderThanDays = 90
): Promise<{ archived: number; errors: number }> {
  return { archived: 0, errors: 0 };
}

export async function createWeeklyRollup(): Promise<string | null> {
  return null;
}
