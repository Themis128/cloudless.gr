import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getCtrOpportunitiesFromLake } from "@/lib/datalake-serve";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const limit = Math.max(1, Math.min(Number(request.nextUrl.searchParams.get("limit")) || 50, 200));
  const payload = await getCtrOpportunitiesFromLake(limit);
  return NextResponse.json({
    opportunities: payload.opportunities,
    fetchedAt: payload.fetchedAt,
    source: payload.source,
    error: payload.error,
    _filters: { limit },
  });
}
