/**
 * Client-side DuckDB-Wasm analytics for Cloudflare Free Tier migration.
 *
 * Replaces AWS Athena with browser-based queries over parquet files stored in R2.
 * Analytics data is pre-aggregated and exported as parquet for efficient querying.
 */

// DuckDB-Wasm types (simplified for browser use)
interface DuckDBResultSet {
  toArray: () => Record<string, unknown>[];
}

interface DuckDBHandle {
  connect: () => Promise<DuckDBConnection>;
}

interface DuckDBConnection {
  query: (sql: string) => Promise<DuckDBResultSet>;
}

// Lazy-loaded DuckDB instance
let duckDBPromise: Promise<DuckDBHandle> | null = null;

async function getDuckDB(): Promise<DuckDBHandle> {
  if (duckDBPromise) return duckDBPromise;

  duckDBPromise = (async () => {
    const duckdb = await import("@duckdb/duckdb-wasm");

    // Create DuckDB instance
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
    const db = new duckdb.AsyncDuckDB(logger);

    // Instantiate with worker
    const workerUrl = new URL(
      "duckdb-browser-eh.worker.js",
      "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.33.1-dev57/dist/"
    ).href;
    await db.instantiate(workerUrl);
    return db as unknown as DuckDBHandle;
  })();

  return duckDBPromise;
}

// Parquet file URL builder
function getParquetUrl(filename: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://cloudless.gr";
  return `${baseUrl}/api/analytics/r2?file=${encodeURIComponent(filename)}`;
}

// Analytics data types
export interface AnalyticsRow {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface KeywordAnalytics {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface PageAnalytics {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Query analytics data from parquet files in R2.
 * Falls back to empty results if DuckDB-Wasm fails to load.
 */
export async function queryAnalytics<T = Record<string, unknown>>(
  sql: string,
  parquetFile?: string
): Promise<T[]> {
  try {
    const db = await getDuckDB();
    const conn = await db.connect();

    if (parquetFile) {
      const url = getParquetUrl(parquetFile);
      await conn.query(`CREATE VIEW analytics AS SELECT * FROM read_parquet('${url}')`);
    }

    const result = await conn.query(sql);
    return result.toArray() as T[];
  } catch (err) {
    console.error("[analytics-client] DuckDB query failed:", err);
    return [];
  }
}

/**
 * Get performance history (clicks, impressions, CTR, position by date).
 */
export async function getPerformanceHistory(weeks = 12): Promise<AnalyticsRow[]> {
  const sql = `
    SELECT 
      date,
      clicks,
      impressions,
      ctr,
      avg_position as position
    FROM analytics
    ORDER BY date DESC
    LIMIT ${weeks * 7}
  `;
  return queryAnalytics<AnalyticsRow>(sql, "gsc-performance.parquet");
}

/**
 * Get top keywords by clicks.
 */
export async function getTopKeywords(limit = 20): Promise<KeywordAnalytics[]> {
  const sql = `
    SELECT 
      keys[1] as keyword,
      clicks,
      impressions,
      ctr,
      position
    FROM analytics
    WHERE dimension = 'query'
    ORDER BY clicks DESC
    LIMIT ${limit}
  `;
  return queryAnalytics<KeywordAnalytics>(sql, "gsc-keywords.parquet");
}

/**
 * Get top pages by clicks.
 */
export async function getTopPages(limit = 25): Promise<PageAnalytics[]> {
  const sql = `
    SELECT 
      keys[1] as page,
      clicks,
      impressions,
      ctr,
      position
    FROM analytics
    WHERE dimension = 'page'
    ORDER BY clicks DESC
    LIMIT ${limit}
  `;
  return queryAnalytics<PageAnalytics>(sql, "gsc-pages.parquet");
}

/**
 * Get SEO snapshot (totals for last 28 days).
 */
export async function getSeoSnapshot(): Promise<{
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}> {
  const sql = `
    SELECT 
      SUM(clicks) as clicks,
      SUM(impressions) as impressions,
      AVG(ctr) * 100 as ctr,
      AVG(position) as avg_position
    FROM analytics
    WHERE dimension IS NULL OR dimension = 'totals'
  `;
  const results = await queryAnalytics<{
    clicks: number;
    impressions: number;
    ctr: number;
    avg_position: number;
  }>(sql, "gsc-snapshot.parquet");

  // Map avg_position to avgPosition to match return type
  const row = results[0];
  return row
    ? { ...row, avgPosition: (row as any).avg_position ?? 0 }
    : { clicks: 0, impressions: 0, ctr: 0, avgPosition: 0 };
}

/**
 * Check if DuckDB-Wasm is available (browser support).
 */
export function isDuckDBAvailable(): boolean {
  return Boolean(
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof crypto !== "undefined" &&
    typeof crypto.subtle !== "undefined"
  );
}
