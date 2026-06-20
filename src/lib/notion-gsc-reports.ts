/**
 * Notion GSC Reports — DECOMMISSIONED 2026-06-20.
 *
 * Replaced by the GSC ETL pipeline (`scripts/etl/gsc-to-lake.mjs` → S3
 * Parquet → Glue → Athena). The Notion DB is no longer the persistence
 * layer for weekly GSC archives. The Notion env var
 * `NOTION_GSC_REPORTS_DB_ID` has been removed from `lib/integrations.ts`
 * + `lib/ssm-config.ts`.
 *
 * This module is kept as a no-op shim so the admin
 * `/api/admin/analytics/gsc-archive` route (and any other reader) doesn't
 * crash. `getGscReports()` returns `null` (matching the original
 * IntegrationNotConfiguredError fallback semantics) — callers already
 * tolerate that case and fall back to the live GSC API.
 *
 * Migration follow-up tracked in memory `project_notion_decom_plan`.
 * Remove this file once consumers query Athena directly via the duckdb-api.
 */

export interface GscTopKeyword {
  q: string;
  clicks: number;
  ctr: number;
}

export interface GscWeeklyReport {
  /** Notion page id — preserved for callers that key off it. */
  id: string;
  /** Title, e.g. "Week of 2026-06-08". */
  week: string;
  /** End date of the 28-day window (ISO date). */
  date: string;
  clicks: number;
  impressions: number;
  ctrPct: number;
  avgPosition: number;
  keywords: number;
  topKeywords: GscTopKeyword[];
  topCountry: string;
  mobilePct: number;
  ctrOpportunities: number;
}

export async function getGscReports(_limit = 26): Promise<GscWeeklyReport[] | null> {
  return null;
}
