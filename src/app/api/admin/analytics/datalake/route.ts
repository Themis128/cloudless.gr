/**
 * GET /api/admin/analytics/datalake
 *
 * Gold serving layer for /admin/analytics/datalake:
 *   - R2 lake/snapshots/admin-datalake.json (ETL materialize — all lake sections)
 *   - D1 analytics_events overlay for acquisition / attribution (hot path)
 *
 * Query params:
 *   ?refresh=1  — re-read gold snapshot from R2 (no live upstream calls)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getDatalakeDashboard } from "@/lib/datalake-r2";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const payload = await getDatalakeDashboard({ refresh });
  return NextResponse.json(payload);
}
