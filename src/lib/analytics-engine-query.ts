/**
 * Analytics Engine SQL query helper (REST) for admin explorer.
 * Dataset: CLOUDFLARE_ANALYTICS_DATASET (default cloudless_analytics).
 */

export function isAnalyticsEngineQueryConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
}

export async function queryAnalyticsEngineSql(
  sql: string
): Promise<{ rows: Record<string, unknown>[]; raw?: unknown }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    throw new Error("Analytics Engine not configured");
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: sql,
      signal: AbortSignal.timeout(15_000),
    }
  );

  const data = (await res.json()) as {
    data?: Record<string, unknown>[];
    meta?: unknown;
    errors?: { message?: string }[];
  };

  if (!res.ok) {
    throw new Error(data.errors?.[0]?.message ?? `Analytics Engine SQL HTTP ${res.status}`);
  }

  return { rows: data.data ?? [], raw: data };
}

export function defaultEdgeLatencySql(dataset = "cloudless_analytics"): string {
  const name = process.env.CLOUDFLARE_ANALYTICS_DATASET?.trim() || dataset;
  return `
SELECT
  blob1 AS path,
  double1 AS latency_ms,
  blob2 AS status,
  _sample_interval
FROM ${name}
WHERE timestamp > NOW() - INTERVAL '1' DAY
ORDER BY timestamp DESC
LIMIT 100
`.trim();
}
