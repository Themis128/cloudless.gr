import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { buildFunnelAudit } from "@/lib/funnel-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/analytics/funnel-audit
 * Tolstova sales-funnel stage audit computed live: EspoCRM stages
 * (lead/nurtured/opportunity/won) + SocialAuto audience/engaged proxies.
 * Each source degrades independently — `sources` reports which were live.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const report = await buildFunnelAudit();
  return NextResponse.json(report);
}
