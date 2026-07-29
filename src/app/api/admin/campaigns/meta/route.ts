import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isMetaAdsConfigured, listMetaCampaigns } from "@/lib/campaigns/meta-ads";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isMetaAdsConfigured())) {
    return NextResponse.json({ error: "Meta Ads not configured." }, { status: 503 });
  }

  try {
    const campaigns = await listMetaCampaigns();
    return NextResponse.json({
      campaigns,
      total: campaigns.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch Meta campaigns." }, { status: 500 });
  }
}
