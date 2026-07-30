/**
 * Cost analytics for `/admin/cost` (R12).
 *
 * Cloudflare-only read path:
 *   1. D1 `aws_cost_daily` when AUTH_DB is bound (ETL: aws-cost-to-r2 + wrangler)
 *   2. R2 `lake/aws-cost/cost.json` when DATALAKE_BUCKET is bound
 *
 * Source data still comes from AWS Cost Explorer (billing API); storage/query
 * is Cloudflare-native. No Athena / S3 reads.
 */
import { getAuthDbFromEnv, type AuthDatabase } from "@/lib/auth-d1";
import { getDataLakeBucketFromEnv } from "@/lib/r2-client";

export interface CostByServiceRow {
  service: string;
  total_usd: number;
}

export interface DailyCostRow {
  cost_date: string;
  total_usd: number;
}

export interface CostSummary {
  total_30d: number;
  yesterday: number;
  topServices: CostByServiceRow[];
  dailyTrend: DailyCostRow[];
  lastEtlAt: string | null;
}

interface CostRow {
  cost_date: string;
  service: string;
  amount_usd: number;
  currency?: string;
}

interface CostSource {
  rows: CostRow[];
  lastEtlAt: string | null;
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function yesterdayIso(): string {
  return daysAgoIso(1);
}

function withinLastDays(costDate: string, days: number): boolean {
  return costDate >= daysAgoIso(days);
}

function enumerateDays(days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) out.push(daysAgoIso(i));
  return out;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function summarize(source: CostSource, limit = 10): CostSummary {
  const windowRows = source.rows.filter((row) => withinLastDays(row.cost_date, 30));
  const total_30d = round2(windowRows.reduce((sum, row) => sum + row.amount_usd, 0));

  const yday = yesterdayIso();
  const yesterday = round2(
    windowRows.filter((row) => row.cost_date === yday).reduce((sum, row) => sum + row.amount_usd, 0)
  );

  const byService = new Map<string, number>();
  for (const row of windowRows) {
    byService.set(row.service, (byService.get(row.service) || 0) + row.amount_usd);
  }
  const topServices = [...byService.entries()]
    .map(([service, total_usd]) => ({ service, total_usd: round2(total_usd) }))
    .sort((a, b) => b.total_usd - a.total_usd)
    .slice(0, Math.max(1, Math.min(limit, 50)));

  const byDay = new Map<string, number>();
  for (const day of enumerateDays(30)) byDay.set(day, 0);
  for (const row of windowRows) {
    if (!byDay.has(row.cost_date)) continue;
    byDay.set(row.cost_date, (byDay.get(row.cost_date) || 0) + row.amount_usd);
  }
  const dailyTrend = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cost_date, total_usd]) => ({ cost_date, total_usd: round2(total_usd) }));

  return { total_30d, yesterday, topServices, dailyTrend, lastEtlAt: source.lastEtlAt };
}

async function loadFromD1(db: AuthDatabase): Promise<CostSource | null> {
  const result = await db
    .prepare(
      `SELECT cost_date, service, amount_usd, currency, synced_at
       FROM aws_cost_daily`
    )
    .all<{
      cost_date: string;
      service: string;
      amount_usd: number;
      currency: string | null;
      synced_at: number | null;
    }>();

  const rows = (result.results ?? []).map((row) => ({
    cost_date: String(row.cost_date),
    service: String(row.service || "unknown"),
    amount_usd: Number(row.amount_usd) || 0,
    currency: row.currency ?? "USD",
  }));
  if (rows.length === 0) return null;

  let maxSynced = 0;
  for (const row of result.results ?? []) {
    if (typeof row.synced_at === "number" && row.synced_at > maxSynced) maxSynced = row.synced_at;
  }

  return {
    rows,
    lastEtlAt: maxSynced > 0 ? new Date(maxSynced).toISOString() : null,
  };
}

async function loadFromR2(): Promise<CostSource | null> {
  const bucket = getDataLakeBucketFromEnv();
  if (!bucket) return null;

  const object = await bucket.get("lake/aws-cost/cost.json");
  if (!object) return null;

  const parsed = JSON.parse(await object.text()) as {
    generated_at?: string;
    rows?: Array<Record<string, unknown>>;
  };
  const rows = (parsed.rows ?? [])
    .map((row) => ({
      cost_date: String(row.cost_date ?? ""),
      service: String(row.service ?? "unknown"),
      amount_usd: Number(row.amount_usd) || 0,
      currency: typeof row.currency === "string" ? row.currency : "USD",
    }))
    .filter((row) => row.cost_date);

  if (rows.length === 0) return null;

  const uploaded =
    "uploaded" in object && object.uploaded instanceof Date
      ? object.uploaded.toISOString()
      : (parsed.generated_at ?? null);

  return { rows, lastEtlAt: uploaded };
}

async function loadCostSource(): Promise<CostSource> {
  const db = getAuthDbFromEnv();
  if (db) {
    try {
      const fromD1 = await loadFromD1(db);
      if (fromD1) return fromD1;
    } catch (error) {
      console.warn(
        "[cost-analytics] D1 read failed:",
        error instanceof Error ? error.message : error
      );
    }
  }

  try {
    const fromR2 = await loadFromR2();
    if (fromR2) return fromR2;
  } catch (error) {
    console.warn(
      "[cost-analytics] R2 read failed:",
      error instanceof Error ? error.message : error
    );
  }

  return { rows: [], lastEtlAt: null };
}

export async function getTopServicesByCost(limit = 10): Promise<CostByServiceRow[]> {
  const summary = await getCostSummary();
  return summary.topServices.slice(0, Math.max(1, Math.min(limit, 50)));
}

export async function getDailyCostTrend(): Promise<DailyCostRow[]> {
  return (await getCostSummary()).dailyTrend;
}

export async function getTotal30d(): Promise<number> {
  return (await getCostSummary()).total_30d;
}

export async function getYesterdayCost(): Promise<number> {
  return (await getCostSummary()).yesterday;
}

export async function getLastEtlAt(): Promise<string | null> {
  return (await getCostSummary()).lastEtlAt;
}

export async function getCostSummary(): Promise<CostSummary> {
  const source = await loadCostSource();
  return summarize(source, 10);
}
