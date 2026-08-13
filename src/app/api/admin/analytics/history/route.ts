import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getSeoFromLake } from "@/lib/datalake-serve";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const days = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("days") ?? "28"), 365 * 2)
  );
  const seo = await getSeoFromLake(days);
  return NextResponse.json({
    history: [],
    snapshot: seo.snapshot,
    fetchedAt: seo.fetchedAt,
    source: seo.source,
    note: "Daily history rollup not in gold yet — use gsc-weekly / top_keywords. No live GSC.",
    error: seo.error,
    _filters: { days },
  });
}
