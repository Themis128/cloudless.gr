/**
 * DuckDB-Wasm Client for Analytics
 *
 * Replaces AWS Athena with client-side parquet queries.
 * Queries run in the browser against R2-hosted data.
 *
 * Usage per Step 5 of the blueprint.
 */

// Analytics Engine schema for events stored from Cloudflare Workers
export interface AnalyticsEvent {
  timestamp: Date;
  index1?: string; // endpoint
  index2?: string; // status
  index3?: string; // user_id
  index4?: string; // method
  index5?: string; // path
  metric1?: number; // latency_ms
  metric2?: number; // duration_ms
  metric3?: number; // bytes_in
  metric4?: number; // bytes_out
}

// Parquet file structure for R2 datalake
export interface ParquetPartition {
  year: string;
  month: string;
  day: string;
  key: string;
}

// Preset queries for parquet data in R2 datalake-bucket
export const ANALYTICS_QUERIES = {
  // Daily funnel metrics - replaces Athena weekly rollup
  dailyFunnel: `
    SELECT 
      day,
      COUNT(*) as total_events,
      AVG(latency_ms) as avg_latency,
      MAX(latency_ms) as max_latency
    FROM read_parquet('datalake-bucket/analytics/year=*/month=*/day=*/*.parquet')
    GROUP BY day
    ORDER BY day DESC
    LIMIT 30
  `,

  // Status breakdown for error monitoring
  statusBreakdown: `
    SELECT 
      status, 
      COUNT(*) as hits, 
      AVG(latency_ms) as avg_latency
    FROM read_parquet('datalake-bucket/analytics/year=*/month=*/*.parquet')
    WHERE day >= current_date - interval '7 days'
    GROUP BY status
    ORDER BY hits DESC
  `,

  // Top endpoints by traffic
  topEndpoints: `
    SELECT 
      endpoint, 
      COUNT(*) as hits, 
      AVG(duration_ms) as avg_duration,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency
    FROM read_parquet('datalake-bucket/analytics/year=*/month=*/*.parquet')
    GROUP BY endpoint 
    ORDER BY hits DESC 
    LIMIT 100
  `,

  // Lead funnel from contact forms
  leadFunnel: `
    SELECT 
      date_trunc('day', timestamp) as day,
      COUNT(*) as leads,
      AVG(CASE WHEN score >= 65 THEN 1 ELSE 0 END) as hot_lead_pct
    FROM contacts_parquet
    GROUP BY day
    ORDER BY day DESC
    LIMIT 90
  `,
};

/**
 * Get parquet file listing from R2 datalake bucket.
 * Used by client-side DuckDB to discover available partitions.
 */
export async function listParquetPartitions(
  r2Client: R2Bucket,
  prefix: string = 'analytics/'
): Promise<ParquetPartition[]> {
  const partitions: ParquetPartition[] = [];
  let cursor: string | undefined;

  do {
    const response = await r2Client.list({ prefix, cursor });
    for (const obj of response.objects) {
      const match = obj.key.match(/analytics\/year=(\d+)\/month=(\d+)\/day=(\d+)\//);
      if (match) {
        partitions.push({
          year: match[1],
          month: match[2],
          day: match[3],
          key: obj.key,
        });
      }
    }
    cursor = response.cursor;
  } while (cursor);

  return partitions.sort((a, b) => 
    `${b.year}${b.month}${b.day}`.localeCompare(`${a.year}${a.month}${a.day}`)
  );
}

/**
 * Get presigned URL for parquet file access.
 * Allows browser-based DuckDB to read R2 data.
 */
export async function getParquetPresignedUrl(
  r2Client: R2Bucket,
  key: string
): Promise<string | null> {
  try {
    // R2 signed URLs work with Workers
    const url = await r2Client.signURL(key, 'GET', 3600);
    return url.toString();
  } catch {
    return null;
  }
}
