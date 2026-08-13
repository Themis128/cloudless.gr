import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getGscDimensionFromLake } from "@/lib/datalake-serve";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const days = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("days") ?? "28"), 365 * 2)
  );
  const payload = await getGscDimensionFromLake("query_page", days);
  return NextResponse.json({
    queryPages: payload.rows,
    snapshot: payload.snapshot,
    fetchedAt: payload.fetchedAt,
    source: payload.source,
    note: payload.note,
    error: payload.error,
    _filters: { days },
  });
}
