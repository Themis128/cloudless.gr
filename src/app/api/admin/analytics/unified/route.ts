import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getUnifiedFromLake } from "@/lib/datalake-serve";

/** Unified analytics — composed from datalake gold (no live GSC/Espo/Stripe). */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const days = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("days") ?? "28"), 365 * 2)
  );

  const payload = await getUnifiedFromLake(days);
  return NextResponse.json({
    seo: payload.seo,
    pipeline: payload.pipeline,
    email: payload.email,
    stripe: payload.stripe,
    attribution: payload.attribution,
    keywords: payload.keywords,
    sectionsMissing: payload.sectionsMissing,
    fetchedAt: payload.fetchedAt,
    source: payload.source,
    _filters: { days },
  });
}
