import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isTikTokConfigured, getTikTokInsights } from "@/lib/campaigns/tiktok";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isTikTokConfigured())) {
    return NextResponse.json({ error: "TikTok not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const dateStart = searchParams.get("start") ?? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const dateEnd = searchParams.get("end") ?? new Date().toISOString().split("T")[0];

  const insights = await getTikTokInsights(dateStart, dateEnd);
  return NextResponse.json({ insights, fetchedAt: new Date().toISOString() });
}
