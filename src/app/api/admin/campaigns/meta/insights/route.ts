import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isMetaAdsConfigured, getMetaInsights } from "@/lib/campaigns/meta-ads";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isMetaAdsConfigured())) {
    return NextResponse.json({ error: "Meta Ads not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const dateStart =
    searchParams.get("start") ?? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const dateEnd = searchParams.get("end") ?? new Date().toISOString().split("T")[0];

  const insights = await getMetaInsights(dateStart, dateEnd);
  return NextResponse.json({ insights, fetchedAt: new Date().toISOString() });
}
