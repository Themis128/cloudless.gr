/**
 * Cloudflare Analytics Engine Integration
 * 
 * Send unlimited-cardinality data from Worker to time-series database.
 * Query with SQL for analytics insights.
 * 
 * Free tier: 10M records/month, 100K queries/day
 * Docs: https://developers.cloudflare.com/analytics-engine/
 */

interface AnalyticsEvent {
  // Required: timestamp (defaults to now)
  timestamp?: Date;
  
  // Index fields (up to 20)
  index1?: string;  // endpoint
  index2?: string;  // status
  index3?: string;  // user_id
  index4?: string;  // method
  index5?: string;  // path
  
  // Metrics (up to 10 doubles)
  metric1?: number; // latency_ms
  metric2?: number; // duration_ms
  metric3?: number; // bytes_in
  metric4?: number; // bytes_out
  metric5?: number; // request_count
}

export function writeAnalyticsEvent(env: any, event: AnalyticsEvent): Promise<void> {
  const {
    timestamp = new Date(),
    index1, index2, index3, index4, index5,
    metric1, metric2, metric3, metric4, metric5
  } = event;

  // Analytics Engine uses prepared statements with INGEST
  const sql = `
    INSERT INTO analytics_events (
      timestamp, 
      index1, index2, index3, index4, index5,
      metric1, metric2, metric3, metric4, metric5
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  return env.ANALYTICS.prepare(sql)
    .bind(
      timestamp.toISOString(),
      index1, index2, index3, index4, index5,
      metric1, metric2, metric3, metric4, metric5
    )
    .run();
}

export async function queryAnalyticsEngine(
  env: any, 
  sql: string,
  binds: any[] = []
): Promise<any[]> {
  const { results } = await env.ANALYTICS.prepare(sql).bind(...binds).all();
  return results;
}

// Preset analytics queries replacing Athena
export const ANALYTICS_QUERIES = {
  dailyRollup: `
    SELECT 
      time_bucket('1d', timestamp) as day,
      count() as total_events,
      avg(metric1) as avg_latency,
      max(metric1) as max_latency
    FROM analytics_events
    GROUP BY day
    ORDER BY day DESC
    LIMIT 30
  `,
  
  statusBreakdown: `
    SELECT 
      index2 as status,
      count() as hits,
      avg(metric1) as avg_latency
    FROM analytics_events
    GROUP BY index2
  `,
  
  topEndpoints: `
    SELECT 
      index1 as endpoint,
      count() as hits,
      avg(metric1) as avg_latency
    FROM analytics_events
    GROUP BY index1
    ORDER BY hits DESC
    LIMIT 100
  `,
  
  latencyHeatmap: `
    SELECT 
      index4 as method,
      index1 as endpoint,
      avg(metric1) as p50,
      percentile(0.95, metric1) as p95,
      max(metric1) as p99
    FROM analytics_events
    WHERE timestamp > now() - interval '1d'
    GROUP BY index4, index1
  `
};