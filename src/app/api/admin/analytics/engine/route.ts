import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  defaultEdgeLatencySql,
  isAnalyticsEngineQueryConfigured,
  queryAnalyticsEngineSql,
} from "@/lib/analytics-engine-query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!isAnalyticsEngineQueryConfigured()) {
    return NextResponse.json(
      {
        error: "Set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN for Analytics Engine SQL.",
        configured: false,
      },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const custom = url.searchParams.get("sql");
  const sql = custom?.trim() || defaultEdgeLatencySql();

  // Safety: only allow SELECT
  if (!/^\s*select\b/i.test(sql)) {
    return NextResponse.json({ error: "Only SELECT queries are allowed." }, { status: 400 });
  }

  try {
    const { rows } = await queryAnalyticsEngineSql(sql);
    return NextResponse.json({
      configured: true,
      sql,
      rows,
      count: rows.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[admin/analytics/engine]", err);
    return NextResponse.json(
      {
        configured: true,
        error: err instanceof Error ? err.message : "Query failed",
        sql,
        rows: [],
      },
      { status: 502 }
    );
  }
}
