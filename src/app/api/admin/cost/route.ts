/**
 * GET /api/admin/cost — admin-gated AWS cost summary.
 *
 * Cloudflare-first: D1 `aws_cost_daily` → R2 `lake/aws-cost/cost.json` →
 * legacy Athena `v_aws_cost_by_service`. Source ETL is Cost Explorer → R2/D1
 * (`scripts/etl/aws-cost-to-r2.mjs`).
 *
 * Returns {total_30d, yesterday, topServices, dailyTrend, lastEtlAt}.
 * 503 with `{configured: false}` when no cost source is available.
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
    // If the view doesn't exist yet, surface as a "not configured" 503 rather
    // than a hard 500. The UI converts this into a friendly "run the R9 DDL"
    // placeholder.
    if (/Table .* does not exist|TABLE_NOT_FOUND|SCHEMA_NOT_FOUND/i.test(msg)) {
      return NextResponse.json(
        {
          error: "athena_view_not_found",
          detail: "Run the R9 Athena DDL (see docs/optimal-architecture-assessment.md) first.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "athena_query_failed", detail: msg.slice(0, 500) },
      { status: 502 }
    );
  }
}
