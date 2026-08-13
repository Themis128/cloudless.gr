import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getSeoFromLake } from "@/lib/datalake-serve";

/**
 * Combined SEO snapshot + top keywords — lake gold only (no live GSC).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const days = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("days") ?? "28"), 365 * 2)
  );

  try {
    const payload = await getSeoFromLake(days);
    return NextResponse.json({
      snapshot: payload.snapshot,
      keywords: payload.keywords,
      fetchedAt: payload.fetchedAt,
      source: payload.source,
      error: payload.error,
      _cache: { source: "datalake-gold", ageSeconds: null },
      _filters: { days },
    });
  } catch (err) {
    console.error("[SEO] lake error:", JSON.stringify(String((err as Error)?.message ?? err)));
    return NextResponse.json({ error: "Failed to load SEO data from datalake." }, { status: 500 });
  }
}
