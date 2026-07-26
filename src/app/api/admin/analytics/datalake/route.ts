/**
 * GET /api/admin/analytics/datalake
 *
 * Single endpoint that fans out 6 Athena queries in parallel and returns one
 * JSON payload for the /admin/analytics/datalake dashboard. Each section
 * degrades independently — a missing table (e.g. ETL hasn't run yet) returns
 * `{ section: "x", error: "..." }` instead of failing the whole response.
 *
 * Query params:
 *   ?refresh=1  — bust the 60-second per-section cache (forces fresh Athena scan)
 *
 * Cost: each view is < 100 KB scanned at our row counts; total per refresh is
 * far below Athena's $5/TB pricing floor. Cached for 60s per query in-process.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { runAthenaQuery, resetAthenaCache } from "@/lib/athena";

interface SectionResult {
  section: string;
  rows?: Record<string, string | number | null>[];
  rowCount?: number;
  fromCache?: boolean;
  error?: string;
}

const QUERIES: Array<{ section: string; sql: string }> = [
  {
    section: "acquisition_funnel",
    // Daily funnel for the last 30 days — sessions / signups / purchasers / revenue.
    sql: "SELECT * FROM cloudless_analytics.v_acquisition_funnel WHERE day >= current_date - interval '30' day ORDER BY day DESC",
  },
  {
    section: "attribution",
    // UTM source/medium → conversions over the 90-day window
    sql: "SELECT * FROM cloudless_analytics.v_attribution_by_source LIMIT 25",
  },
  {
    section: "top_keywords",
    // GSC top 25 keywords with clicks / CTR / avg position
    sql: "SELECT * FROM cloudless_analytics.v_gsc_top_keywords LIMIT 25",
  },
  {
    section: "linkedin_ads",
    // Per-campaign 90-day rollup
    sql: "SELECT * FROM cloudless_analytics.v_linkedin_ads_summary",
  },
  {
    section: "top_errors",
    // Sentry top 10 unresolved by 14d count
    sql: "SELECT * FROM cloudless_analytics.v_sentry_top_issues LIMIT 10",
  },
  {
    section: "hubspot_funnel",
    // Lifecycle stage breakdown
    sql: "SELECT * FROM cloudless_analytics.v_hubspot_funnel LIMIT 20",
  },
];

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  if (refresh) resetAthenaCache();

  // Fan out — each query degrades on its own. Promise.allSettled keeps the
  // whole route from failing if a single view doesn't exist yet (e.g. the
  // matching ETL has not produced its first parquet file).
  const settled = await Promise.allSettled(
    QUERIES.map(async ({ section, sql }) => {
      const result = await runAthenaQuery(sql, { skipCache: refresh });
      return { section, ...result };
    })
  );

  const sections: SectionResult[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    const err = s.reason instanceof Error ? s.reason.message : String(s.reason);
    return { section: QUERIES[i].section, error: err.slice(0, 300) };
  });

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    cache: refresh ? "skipped" : "respected",
    sections,
  });
}
