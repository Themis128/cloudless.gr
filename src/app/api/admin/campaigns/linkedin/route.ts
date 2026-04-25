import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  isLinkedInConfigured,
  listLinkedInCampaigns,
} from "@/lib/campaigns/linkedin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isLinkedInConfigured())) {
    return NextResponse.json(
      { error: "LinkedIn not configured." },
      { status: 503 },
    );
  }

  try {
    const campaigns = await listLinkedInCampaigns();
    return NextResponse.json({
      campaigns,
      total: campaigns.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch LinkedIn campaigns." },
      { status: 500 },
    );
  }
}
