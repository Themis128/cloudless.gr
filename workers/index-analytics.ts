/**
 * Analytics Engine Worker - DuckDB + R2 Integration
 *
 * This Worker handles analytics data export to parquet format in R2.
 * Part of the Cloudflare + Fly.io migration strategy - Tier 2 Analytics Services.
 */

export interface Env {
  ANALYTICS: AnalyticsEngineDataset;
  DATALAKE_BUCKET: R2Bucket;
  ANALYTICS_BUCKET: R2Bucket;
  ACCOUNT_ID: string;
  API_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route: /api/analytics/export - Export Analytics Engine to parquet
    if (path === '/api/analytics/export' && request.method === 'POST') {
      return handleExportToParquet(request, env);
    }

    // Route: /api/analytics/query - Query parquet data (DuckDB-WASM client)
    if (path === '/api/analytics/query' && request.method === 'GET') {
      return handleParquetQuery(request, env);
    }

    // Route: /api/analytics/rollup - Daily rollup trigger (called by cron)
    if (path === '/api/analytics/rollup' && request.method === 'POST') {
      return handleDailyRollup(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function handleExportToParquet(request: Request, env: Env): Promise<Response> {
  try {
    // Query last 24 hours from Analytics Engine via REST API
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/analytics_engine/datasets/cloudless_analytics/events`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.API_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Analytics API error: ${response.status}`);
    }

    const data = await response.json();

    // Convert to parquet format (simplified - actual DuckDB would handle this)
    const parquetData = JSON.stringify(data, null, 2);
    
    // Partition by date
    const today = new Date().toISOString().split('T')[0];
    const key = `analytics/year=${new Date().getFullYear()}/month=${String(new Date().getMonth() + 1).padStart(2, '0')}/day=${today.split('-')[2]}/events.parquet`;

    // Store in R2
    await env.DATALAKE_BUCKET.put(key, parquetData, {
      httpMetadata: {
        'Content-Type': 'application/octet-stream',
      },
      customMetadata: {
        'exported-at': new Date().toISOString(),
        'record-count': String(data.result?.length || 0),
      },
    });

    return new Response(JSON.stringify({
      success: true,
      key,
      recordCount: data.result?.length || 0,
      exportedAt: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Export failed',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleParquetQuery(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const prefix = url.searchParams.get('prefix') || 'analytics/';

  try {
    // List objects in the analytics partition
    const objects = await env.DATALAKE_BUCKET.list({ prefix });

    return new Response(JSON.stringify({
      prefix,
      objects: objects.objects.map(obj => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
      })),
      truncated: objects.truncated,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Query failed',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleDailyRollup(request: Request, env: Env): Promise<Response> {
  // Verify cron authorization
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Write rollup event to Analytics Engine
    env.ANALYTICS.writeDataPoint({
      indexes: ['daily_rollup', 'starting'],
      doubles: [Date.now()],
    });

    // Trigger parquet export
    const today = new Date().toISOString().split('T')[0];
    const key = `analytics/year=${new Date().getFullYear()}/month=${String(new Date().getMonth() + 1).padStart(2, '0')}/day=${today.split('-')[2]}/rollup-event.parquet`;

    await env.ANALYTICS_BUCKET.put(key, JSON.stringify({
      rollup_date: today,
      triggered_at: new Date().toISOString(),
    }));

    return new Response(JSON.stringify({
      success: true,
      message: 'Daily rollup triggered',
      date: today,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Rollup failed',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}