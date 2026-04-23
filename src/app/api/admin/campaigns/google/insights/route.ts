import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isGoogleAdsConfigured, getGoogleMetrics } from "@/lib/campaigns/google-ads";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isGoogleAdsConfigured())) {
    return NextResponse.json({ error: "Google Ads not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const dateStart = searchParams.get("start") ?? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const dateEnd = searchParams.get("end") ?? new Date().toISOString().split("T")[0];

  const metrics = await getGoogleMetrics(dateStart, dateEnd);
  return NextResponse.json({ metrics, fetchedAt: new Date().toISOString() });
}
