import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isActiveCampaignConfigured, listCampaigns } from "@/lib/activecampaign";

const AC_SETUP = {
  configured: false as const,
  setupUrl: "https://www.activecampaign.com",
  message:
    "ActiveCampaign is not configured. Add ACTIVECAMPAIGN_API_URL and ACTIVECAMPAIGN_API_TOKEN to cloudless-secrets (or SSM).",
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isActiveCampaignConfigured())) {
    return NextResponse.json({ ...AC_SETUP, campaigns: [], total: 0 });
  }

  const campaigns = await listCampaigns(50);
  return NextResponse.json({ configured: true, campaigns, total: campaigns.length });
}
