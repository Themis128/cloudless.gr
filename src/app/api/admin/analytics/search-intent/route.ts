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
    intents: [],
    keywords: seo.keywords,
    snapshot: seo.snapshot,
    fetchedAt: seo.fetchedAt,
    source: seo.source,
    note: "Search-intent classification not in gold yet — keywords from top_keywords. No live GSC.",
    error: seo.error,
    _filters: { days },
  });
}
