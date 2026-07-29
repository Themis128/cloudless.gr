/**
 * GET /api/admin/analytics/datalake
 *
 * Cloudflare-first dashboard payload for /admin/analytics/datalake:
 *   - D1 analytics_events for acquisition / attribution when AUTH_DB bound
 *   - R2 lake/snapshots/admin-datalake.json for GSC / Sentry / LinkedIn / EspoCRM
 *   - Legacy Athena views only for missing sections
 *
 * Query params:
 *   ?refresh=1  — skip R2 snapshot cache; re-query Athena for gaps
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
