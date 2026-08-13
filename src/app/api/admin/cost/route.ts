/**
 * GET /api/admin/cost — admin-gated AWS cost summary.
 *
 * Cloudflare-only frozen snapshot: D1 `aws_cost_daily` → R2 `lake/aws-cost/cost.json`.
 * Cost Explorer ETL retired (PR-17); no new AWS billing pulls.
 *
 * Returns {total_30d, yesterday, topServices, dailyTrend, lastEtlAt}.
 * Empty summary when no cost source is available.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getCostSummary } from "@/lib/cost-analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const summary = await getCostSummary();
    return NextResponse.json(summary, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (err) {
    const msg = (err as Error).message;
    return NextResponse.json(
      { error: "cost_read_failed", detail: msg.slice(0, 500) },
      { status: 502 }
    );
  }
}
