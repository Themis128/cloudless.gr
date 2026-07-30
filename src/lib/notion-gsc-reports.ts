/**
 * GSC Weekly Reports — Cloudflare R2 snapshot only.
 *
 * Reads pre-aggregated weekly rollups from
 * `lake/snapshots/gsc-weekly.json` (written by
 * scripts/etl/materialize-datalake-snapshots.mjs from GSC parquet).
 *
 * Returns `null` when DATALAKE_BUCKET is unbound or the snapshot is missing.
 */

import { getDataLakeBucketFromEnv } from "@/lib/r2-client";

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
  topCountry: string;
  mobilePct: number;
  /** Queries with impressions ≥ 20 and ctr < 2 (Notion baseline definition). */
  ctrOpportunities: number;
}

const GSC_SNAPSHOT_KEY = "lake/snapshots/gsc-weekly.json";

interface GscWeeklySnapshot {
  generated_at?: string;
  reports?: GscWeeklyReport[];
}

export async function getGscReports(limit = 26): Promise<GscWeeklyReport[] | null> {
  const cap = Math.max(1, Math.min(limit, 52));
  const bucket = getDataLakeBucketFromEnv();
  if (!bucket) return null;

  try {
    const object = await bucket.get(GSC_SNAPSHOT_KEY);
    if (!object) return null;

    const parsed = JSON.parse(await object.text()) as GscWeeklySnapshot;
    const reports = parsed?.reports;
    if (!Array.isArray(reports) || reports.length === 0) return null;

    return reports.slice(0, cap);
  } catch (err) {
    console.warn(
      "[notion-gsc-reports] R2 snapshot read failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
