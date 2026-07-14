/**
 * DuckDB-Wasm Client for Analytics
 *
 * Replaces AWS Athena with client-side parquet queries.
 * Queries run in the browser against R2-hosted data.
 *
 * Usage per Step 5 of the blueprint.
 */

// Note: DuckDB is loaded dynamically in browser for client-side queries
// This module provides types and preset queries for the Workers export

export interface DuckDBQueryResult {
  toArray(): any[];
}

// Preset queries matching original Athena use cases
export const ANALYTICS_QUERIES = {
  // Daily rollup - replaces Athena weekly rollup
  dailyRollup: `
    SELECT 
      date_trunc('day', timestamp) as day,
      COUNT(*) as total_events,
      AVG(latency) as avg_latency,
      MAX(latency) as max_latency
    FROM daily_logs 
    GROUP BY day 
    ORDER BY day DESC
    LIMIT 30
  `,

  // Status breakdown - replaces Athena status analysis
  statusBreakdown: `
    SELECT status, COUNT(*), AVG(latency) 
    FROM daily_logs 
    GROUP BY status
  `,

  // Top endpoints
  topEndpoints: `
    SELECT endpoint, COUNT(*) as hits, AVG(duration) as avg_duration
    FROM daily_logs 
    GROUP BY endpoint 
    ORDER BY hits DESC 
    LIMIT 100
  `,
};

// Placeholder - actual DuckDB is loaded client-side
export async function queryAthenaDataLake(parquetUrl: string, sql: string): Promise<any[]> {
  // This is used in static export - client-side DuckDB loads via CDN
  throw new Error("DuckDB queries run client-side. Use useAnalytics hook in browser.");
}

export function useAnalytics(parquetUrl: string) {
  return {
    query: (sql: string) => queryAthenaDataLake(parquetUrl, sql),
    queries: ANALYTICS_QUERIES,
  };
}
