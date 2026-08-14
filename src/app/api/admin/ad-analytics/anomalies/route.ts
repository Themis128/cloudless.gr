import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listAnomalyHistory } from "@/lib/ad-analytics/anomaly-log";

/** Recent ad-analytics anomalies (D1 event log, bookmark fallback). Read-only. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const limit = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("limit") ?? "50"), 200)
  );

  try {
    const anomalies = await listAnomalyHistory(limit);
    return NextResponse.json({
      anomalies,
      total: anomalies.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[admin/ad-analytics/anomalies]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to load anomaly history." }, { status: 500 });
  }
}
