/**
 * Notion Analytics — DECOMMISSIONED 2026-06-20.
 *
 * Replaced by Athena views over the data lake (events flow Plausible →
 * Lambda → S3 Parquet → Glue → Athena). The Notion DB is no longer the
 * system of record for site analytics; queries should target Athena via
 * the duckdb-api/duckdb-ml-api admin routes.
 *
 * This module is kept as a no-op shim so callers (track API, blog/docs
 * page-view emits, cron rollups, admin/notion/analytics pages) don't
 * crash. Each function preserves its original signature and returns
 * empty / null. The Notion env var `NOTION_ANALYTICS_DB_ID` has been
 * removed from `lib/integrations.ts` + `lib/ssm-config.ts`.
 *
 * Migration follow-up tracked in memory `project_notion_decom_plan`.
 * Remove this file once the consumers either go through Athena directly
 * or stop calling these helpers entirely.
 */

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

// ---------------------------------------------------------------------------
// No-op shim implementations
// ---------------------------------------------------------------------------

const EMPTY_SUMMARY: AnalyticsSummary = {
  totalEvents: 0,
  byType: {},
  topPages: [],
  topSources: [],
  recentEvents: [],
};

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

// getRecentEvents historically accepted either a limit (number) or an
// AnalyticsEventType filter — kept flexible so existing call sites compile.
export async function getRecentEvents(
  _filterOrLimit?: AnalyticsEventType | number,
  _limit = 50
): Promise<AnalyticsEvent[]> {
  return [];
}

export async function getEventsByDateRange(
  _startISO: string,
  _endISO: string
): Promise<AnalyticsEvent[]> {
  return [];
}

export async function getAnalyticsSummary(_days = 7): Promise<AnalyticsSummary> {
  return EMPTY_SUMMARY;
}

export async function archiveOldEvents(
  _olderThanDays = 90
): Promise<{ archived: number; errors: number }> {
  return { archived: 0, errors: 0 };
}

export async function createWeeklyRollup(): Promise<string | null> {
  return null;
}
