import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isActiveCampaignConfigured, listAutomations } from "@/lib/activecampaign";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isActiveCampaignConfigured())) {
    return NextResponse.json({
      configured: false,
      automations: [],
      total: 0,
      message:
        "ActiveCampaign is not configured. Add ACTIVECAMPAIGN_API_URL and ACTIVECAMPAIGN_API_TOKEN.",
      setupUrl: "https://www.activecampaign.com",
    });
  }

  const automations = await listAutomations();
  return NextResponse.json({ configured: true, automations, total: automations.length });
}
