import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isXConfigured, listXCampaigns } from "@/lib/campaigns/x-ads";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isXConfigured())) {
    return NextResponse.json(
      { error: "X (Twitter) not configured." },
      { status: 503 },
    );
  }

  try {
    const campaigns = await listXCampaigns();
    return NextResponse.json({
      campaigns,
      total: campaigns.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch X campaigns." },
      { status: 500 },
    );
  }
}
