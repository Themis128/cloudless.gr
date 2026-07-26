/**
 * GSC Weekly Reports — DECOMMISSIONED 2026-06-20 (PR #1044), reads NOW
 * route to Athena (PR #1050).
 *
 * The old NOTION_GSC_REPORTS_DB_ID database stored one Notion page per week
 * with curated aggregates (clicks, impressions, CTR%, top keywords, top
 * country, mobile share, CTR-opportunity count). The GSC ETL workflow
 * (`scripts/etl/gsc-to-lake.mjs`) now writes the same source data to
 * `cloudless_analytics.gsc_keywords` (Parquet, 90d rolling). This module
 * aggregates that table back into the GscWeeklyReport shape so the existing
 * admin consumers don't need to change.
 *
 * Outside-of-Athena contexts (local dev): returns `null` (matching the
 * IntegrationNotConfiguredError fallback the previous Notion-backed version
 * threw) — callers already tolerate that.
 */

import { runAthenaQuery } from "@/lib/athena";

export interface GscTopKeyword {
  q: string;
  clicks: number;
  ctr: number;
}

export interface GscWeeklyReport {
  /** Synthetic stable key — week-end ISO date. */
  id: string;
  /** Title, e.g. "Week of 2026-06-08". */
  week: string;
  /** End date of the 7-day window (ISO date). */
  date: string;
  clicks: number;
  impressions: number;
  ctrPct: number;
  avgPosition: number;
  keywords: number;
  topKeywords: GscTopKeyword[];
  /** Not surfaced in the Athena table; left blank. Operator can extend the
   *  gsc-to-lake ETL to write a `country` column if this becomes important. */
  topCountry: string;
  /** Same — Athena table doesn't carry a mobile share dimension yet. */
  mobilePct: number;
  /** Queries with impressions ≥ 20 and ctr < 2 (Notion baseline definition). */
  ctrOpportunities: number;
}

export async function getGscReports(limit = 26): Promise<GscWeeklyReport[] | null> {
  const cap = Math.max(1, Math.min(limit, 52));
  // Week-end is derived from end_date in gsc_keywords. The ETL writes one
  // row per (week, query, page), so we aggregate per week-end first, then
  // attach a top-5 keyword list per week with a second pass query.
  const summarySql = `
    SELECT end_date,
           SUM(clicks) AS clicks,
           SUM(impressions) AS impressions,
           CASE WHEN SUM(impressions) > 0
                THEN ROUND(100.0 * SUM(clicks) / SUM(impressions), 2)
                ELSE 0.0 END AS ctr_pct,
           AVG(position) AS avg_position,
           COUNT(DISTINCT query) AS keywords,
           SUM(CASE WHEN impressions >= 20 AND ctr < 0.02 THEN 1 ELSE 0 END) AS ctr_opportunities
    FROM cloudless_analytics.gsc_keywords
    GROUP BY end_date
    ORDER BY end_date DESC
    LIMIT ${cap}
  `;
  const summary = await runAthenaQuery(summarySql, { ttlMs: 15 * 60_000 }).catch((err) => {
    console.warn("[notion-gsc-reports] Athena summary failed:", err?.message ?? err);
    return null;
  });
  if (!summary || summary.rows.length === 0) return null;

  // Top-5 keywords per week (small enough to inline; bounded by cap × 5).
  const topSql = `
    WITH ranked AS (
      SELECT end_date, query, clicks, ctr,
             ROW_NUMBER() OVER (PARTITION BY end_date ORDER BY clicks DESC) AS rn
      FROM cloudless_analytics.gsc_keywords
    )
    SELECT end_date, query, clicks, ctr
    FROM ranked
    WHERE rn <= 5
    ORDER BY end_date DESC, rn
  `;
  const top = await runAthenaQuery(topSql, { ttlMs: 15 * 60_000 }).catch((err) => {
    console.warn("[notion-gsc-reports] Athena top-keywords failed:", err?.message ?? err);
    return { rows: [] as Record<string, string | number | null>[] };
  });

  const topByWeek = new Map<string, GscTopKeyword[]>();
  for (const r of top.rows) {
    const k = String(r.end_date ?? "");
    if (!k) continue;
    const bucket = topByWeek.get(k) ?? [];
    bucket.push({
      q: String(r.query ?? ""),
      clicks: Number(r.clicks ?? 0),
      ctr: Number(r.ctr ?? 0),
    });
    topByWeek.set(k, bucket);
  }

  return summary.rows.map((row): GscWeeklyReport => {
    const end = String(row.end_date ?? "");
    return {
      id: end || crypto.randomUUID(),
      week: `Week of ${end}`,
      date: end,
      clicks: Number(row.clicks ?? 0),
      impressions: Number(row.impressions ?? 0),
      ctrPct: Number(row.ctr_pct ?? 0),
      avgPosition: Number(row.avg_position ?? 0),
      keywords: Number(row.keywords ?? 0),
      topKeywords: topByWeek.get(end) ?? [],
      topCountry: "",
      mobilePct: 0,
      ctrOpportunities: Number(row.ctr_opportunities ?? 0),
    };
  });
}
