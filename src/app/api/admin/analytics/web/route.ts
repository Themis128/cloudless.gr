import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getSeoFromLake } from "@/lib/datalake-serve";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const seo = await getSeoFromLake(28);
  return NextResponse.json({
    analytics: {
      clicks: seo.snapshot.clicks,
      impressions: seo.snapshot.impressions,
      ctr: seo.snapshot.ctr,
      position: seo.snapshot.position,
    },
    fetchedAt: seo.fetchedAt,
    source: seo.source,
    note: "Web analytics served from gold SEO snapshot (no live GSC).",
    error: seo.error,
  });
}
