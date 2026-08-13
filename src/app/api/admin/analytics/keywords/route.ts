import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getSeoFromLake } from "@/lib/datalake-serve";

/** Top keywords — lake gold only (no live GSC). */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const DEFAULT_LIMIT = 20;
  const MAX_LIMIT = 100;
  const limit = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("limit") ?? String(DEFAULT_LIMIT)), MAX_LIMIT)
  );
  const days = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("days") ?? "28"), 365 * 2)
  );

  try {
    const payload = await getSeoFromLake(days);
    return NextResponse.json({
      keywords: payload.keywords.slice(0, limit),
      fetchedAt: payload.fetchedAt,
      source: payload.source,
      error: payload.error,
      _cache: { source: "datalake-gold", ageSeconds: null },
      _filters: { days, limit },
    });
  } catch (err) {
    console.error("[GSC keywords] lake error:", JSON.stringify(String((err as Error)?.message ?? err)));
    return NextResponse.json({ error: "Failed to load keywords from datalake." }, { status: 500 });
  }
}
