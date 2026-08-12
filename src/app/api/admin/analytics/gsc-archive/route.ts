import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getGscReports } from "@/lib/notion-gsc-reports";

/**
 * Persisted weekly GSC archive (R2 snapshot at lake/snapshots/gsc-weekly.json,
 * written by scripts/etl/materialize-datalake-snapshots.mjs). Distinct from
 * /api/admin/analytics/history, which queries the GSC API live.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const DEFAULT_LIMIT = 26;
  const MAX_LIMIT = 100;
  const limit = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("limit") ?? String(DEFAULT_LIMIT)), MAX_LIMIT)
  );

  try {
    const reports = await getGscReports(limit);
    if (reports === null) {
      return NextResponse.json(
        {
          error:
            "GSC archive unavailable — DATALAKE_BUCKET unbound or lake/snapshots/gsc-weekly.json missing.",
          reports: [],
        },
        { status: 503 }
      );
    }
    return NextResponse.json({
      reports,
      count: reports.length,
      fetchedAt: new Date().toISOString(),
      source: "r2-datalake",
    });
  } catch (err) {
    console.error("[GSC archive] Error:", err);
    return NextResponse.json({ error: "Failed to fetch GSC archive." }, { status: 500 });
  }
}
