/**
 * Cost analytics helper — queries the `cloudless_analytics.v_aws_cost_by_service`
 * Athena view (created in R9, populated daily by `scripts/etl/aws-cost-to-lake.mjs`).
 *
 * Powers the `/admin/cost` page (R12). Bypasses the SCP-blocked Grafana
 * Athena path by querying directly from the Next.js Lambda (which has its
 * own IAM grant on Athena via the deploy role — verified working).
 *
 * All queries are bounded by date + grouped server-side; result sets are
 * small (≤200 rows for the 30-day-by-service shape).
 */
import { runAthenaQuery } from "@/lib/athena";

export interface CostByServiceRow {
  service: string;
  total_usd: number;
}

export interface DailyCostRow {
  cost_date: string; // YYYY-MM-DD
  total_usd: number;
}

export interface CostSummary {
  total_30d: number;
  yesterday: number;
  topServices: CostByServiceRow[]; // top 10
  dailyTrend: DailyCostRow[]; // last 30 days
  lastEtlAt: string | null; // ISO timestamp of the most recent ETL load
}

/**
 * Top N services by 30-day spend.
 * Returns highest → lowest. Default 10.
 */
export async function getTopServicesByCost(limit = 10): Promise<CostByServiceRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const sql = `
    SELECT service, round(sum(amount_usd), 2) AS total_usd
    FROM cloudless_analytics.v_aws_cost_by_service
    WHERE cost_date >= date_format(current_date - interval '30' day, '%Y-%m-%d')
    GROUP BY service
    ORDER BY total_usd DESC
    LIMIT ${safeLimit}
  `;
  const { rows } = await runAthenaQuery(sql);
  return rows.map((r) => ({
    service: String(r.service ?? "unknown"),
    total_usd: Number.parseFloat(String(r.total_usd ?? "0")) || 0,
  }));
}

/**
 * Daily total spend, last 30 days (oldest → newest).
 * Used for the time-series chart on /admin/cost.
 */
export async function getDailyCostTrend(): Promise<DailyCostRow[]> {
  const sql = `
    SELECT cost_date, round(sum(amount_usd), 2) AS total_usd
    FROM cloudless_analytics.v_aws_cost_by_service
    WHERE cost_date >= date_format(current_date - interval '30' day, '%Y-%m-%d')
    GROUP BY cost_date
    ORDER BY cost_date ASC
  `;
  const { rows } = await runAthenaQuery(sql);
  return rows.map((r) => ({
    cost_date: String(r.cost_date ?? ""),
    total_usd: Number.parseFloat(String(r.total_usd ?? "0")) || 0,
  }));
}

/** 30-day total — single number. */
export async function getTotal30d(): Promise<number> {
  const sql = `
    SELECT round(sum(amount_usd), 2) AS total_usd
    FROM cloudless_analytics.v_aws_cost_by_service
    WHERE cost_date >= date_format(current_date - interval '30' day, '%Y-%m-%d')
  `;
  const { rows } = await runAthenaQuery(sql);
  return Number.parseFloat(String(rows[0]?.total_usd ?? "0")) || 0;
}

/**
 * Yesterday's total — single number. Useful for surfacing sudden spikes on
 * the operator's first-thing-Monday glance.
 */
export async function getYesterdayCost(): Promise<number> {
  const sql = `
    SELECT round(sum(amount_usd), 2) AS total_usd
    FROM cloudless_analytics.v_aws_cost_by_service
    WHERE cost_date = date_format(current_date - interval '1' day, '%Y-%m-%d')
  `;
  const { rows } = await runAthenaQuery(sql);
  return Number.parseFloat(String(rows[0]?.total_usd ?? "0")) || 0;
}

/**
 * Most recent ETL upload timestamp — proves the data is fresh. Read from
 * the S3 LastModified of `lake/aws-cost/cost.parquet` rather than from the
 * Athena view (Athena doesn't expose ingestion time).
 *
 * Failure to fetch returns null — the UI shows "—" instead of crashing.
 */
export async function getLastEtlAt(): Promise<string | null> {
  try {
    const s3 = createR2ClientFromEnv();
    const out = await s3.send(
      new HeadObjectCommand({
        Bucket: process.env.ANALYTICS_BUCKET || "cloudless-analytics-data",
        Key: "lake/aws-cost/cost.parquet",
      })
    );
    return out.LastModified ? out.LastModified.toISOString() : null;
  } catch {
    return null;
  }
}

/** One-shot bundler — the `/api/admin/cost` route returns this shape. */
export async function getCostSummary(): Promise<CostSummary> {
  const [total_30d, yesterday, topServices, dailyTrend, lastEtlAt] = await Promise.all([
    getTotal30d(),
    getYesterdayCost(),
    getTopServicesByCost(10),
    getDailyCostTrend(),
    getLastEtlAt(),
  ]);
  return { total_30d, yesterday, topServices, dailyTrend, lastEtlAt };
}
