import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isTikTokConfigured, listTikTokCampaigns } from "@/lib/campaigns/tiktok";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isTikTokConfigured())) {
    return NextResponse.json({ error: "TikTok not configured." }, { status: 503 });
  }

  try {
    const campaigns = await listTikTokCampaigns();
    return NextResponse.json({ campaigns, total: campaigns.length, fetchedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "Failed to fetch TikTok campaigns." }, { status: 500 });
  }
}
