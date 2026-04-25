import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  isGoogleAdsConfigured,
  listGoogleCampaigns,
} from "@/lib/campaigns/google-ads";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isGoogleAdsConfigured())) {
    return NextResponse.json(
      { error: "Google Ads not configured." },
      { status: 503 },
    );
  }

  try {
    const campaigns = await listGoogleCampaigns();
    return NextResponse.json({
      campaigns,
      total: campaigns.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch Google Ads campaigns." },
      { status: 500 },
    );
  }
}
