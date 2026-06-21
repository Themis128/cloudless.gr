/**
 * Notion Analytics — DECOMMISSIONED 2026-06-20, reads NOW route to Athena.
 *
 * The Notion `NOTION_ANALYTICS_DB_ID` database was decommissioned in PR #1044.
 * PR #1050 wires the read surface to the existing `cloudless_analytics.events`
 * Athena table (NDJSON, partitioned by year/month/day, written real-time by
 * the analytics Lambda — see `docs/analytics-athena.sql`).
 *
 * Write paths (trackEvent / trackBlogView / trackFormSubmission) remain
 * no-ops because emission already happens via Plausible + the S3-events
 * Lambda, NOT through this module. Consumers that called the old write
 * functions don't need a replacement — the data already flows.
 *
 * Outside-of-Athena contexts (local dev without AWS creds, preview deploys):
 * every function returns empty data so callers don't crash. The admin tile
 * shows zeros instead of erroring.
 */

import { runAthenaQuery, type AthenaQueryResult } from "@/lib/athena";

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

// Athena row shape from cloudless_analytics.events
type EventRow = Record<string, string | number | null>;

function rowToEvent(r: EventRow): AnalyticsEvent {
  return {
    id: String(r.id ?? r.session_id ?? r.timestamp ?? ""),
    event: String(r.event ?? ""),
    type: (r.event ?? "page_view") as AnalyticsEventType,
    page: String(r.page ?? ""),
    source: String(r.source ?? ""),
    count: 1,
    date: String(r.timestamp ?? ""),
    country: String(r.country ?? ""),
    metadata: String(r.properties ?? ""),
  };
}

function safeQuery<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  return fn().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[notion-analytics] Athena ${label} failed:`, msg);
    return fallback;
  });
}

const EMPTY_RESULT: AthenaQueryResult = { rows: [], rowCount: 0, fromCache: false };

// ---------------------------------------------------------------------------
// Write paths — no-op (data flows via Plausible + S3-events Lambda, not here)
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
// Read paths — Athena-backed
// ---------------------------------------------------------------------------

/** Recent events from cloudless_analytics.events. Optional event-type filter. */
export async function getRecentEvents(
  filterOrLimit?: AnalyticsEventType | number,
  limit = 50
): Promise<AnalyticsEvent[]> {
  const typeFilter = typeof filterOrLimit === "string" ? filterOrLimit : null;
  const cap = typeof filterOrLimit === "number" ? filterOrLimit : Math.max(1, Math.min(limit, 500));
  const where = typeFilter ? `WHERE event = '${typeFilter.replace(/'/g, "''")}' ` : "";
  const sql =
    `SELECT \`timestamp\`, event, page, source, country, properties ` +
    `FROM cloudless_analytics.events ${where}` +
    `ORDER BY \`timestamp\` DESC LIMIT ${cap}`;
  const res = await safeQuery("getRecentEvents", EMPTY_RESULT, () =>
    runAthenaQuery(sql, { ttlMs: 60_000 })
  );
  return res.rows.map(rowToEvent);
}

export async function getEventsByDateRange(
  startISO: string,
  endISO: string
): Promise<AnalyticsEvent[]> {
  const sql =
    `SELECT \`timestamp\`, event, page, source, country, properties ` +
    `FROM cloudless_analytics.events ` +
    `WHERE \`timestamp\` >= '${startISO.replace(/'/g, "")}' ` +
    `AND \`timestamp\` < '${endISO.replace(/'/g, "")}' ` +
    `ORDER BY \`timestamp\` DESC LIMIT 1000`;
  const res = await safeQuery("getEventsByDateRange", EMPTY_RESULT, () =>
    runAthenaQuery(sql, { ttlMs: 60_000 })
  );
  return res.rows.map(rowToEvent);
}

export async function getAnalyticsSummary(days = 7): Promise<AnalyticsSummary> {
  const cap = Math.max(1, Math.min(days, 365));
  // Single round-trip: emit four UNION ALL'd resultsets we collapse client-side.
  // Cheaper than 4 separate Athena starts at >$5/TB-scanned billing.
  const sql = `
    WITH win AS (
      SELECT event, page, source, country, \`timestamp\`, properties
      FROM cloudless_analytics.events
      WHERE \`timestamp\` >= to_iso8601(current_timestamp - interval '${cap}' day)
    )
    SELECT 'total' AS kind, '' AS k, COUNT(*) AS n FROM win
    UNION ALL
    SELECT 'type' AS kind, event AS k, COUNT(*) AS n FROM win GROUP BY event
    UNION ALL
    SELECT 'page' AS kind, page AS k, COUNT(*) AS n FROM win
      WHERE page IS NOT NULL AND page <> '' GROUP BY page ORDER BY n DESC LIMIT 10
    UNION ALL
    SELECT 'source' AS kind, source AS k, COUNT(*) AS n FROM win
      WHERE source IS NOT NULL AND source <> '' GROUP BY source ORDER BY n DESC LIMIT 10
  `;
  const res = await safeQuery("getAnalyticsSummary", EMPTY_RESULT, () =>
    runAthenaQuery(sql, { ttlMs: 5 * 60_000 })
  );
  if (res.rows.length === 0) return EMPTY_SUMMARY;

  const summary: AnalyticsSummary = {
    totalEvents: 0,
    byType: {},
    topPages: [],
    topSources: [],
    recentEvents: [],
  };
  for (const r of res.rows) {
    const kind = String(r.kind ?? "");
    const k = String(r.k ?? "");
    const n = Number(r.n ?? 0);
    if (kind === "total") summary.totalEvents = n;
    else if (kind === "type" && k) summary.byType[k] = n;
    else if (kind === "page" && k) summary.topPages.push({ page: k, count: n });
    else if (kind === "source" && k) summary.topSources.push({ source: k, count: n });
  }
  // 10 recent events as a sample for the admin UI
  summary.recentEvents = await getRecentEvents(10);
  return summary;
}

export async function archiveOldEvents(
  _olderThanDays = 90
): Promise<{ archived: number; errors: number }> {
  // S3 lifecycle policy handles Glacier transition for the events bucket;
  // application-level archival no longer applies.
  return { archived: 0, errors: 0 };
}

export async function createWeeklyRollup(): Promise<string | null> {
  // Rollups now live in Athena views (v_acquisition_funnel, v_attribution_by_source).
  // No-op the manual Notion-page rollup since the view auto-aggregates.
  return null;
}
