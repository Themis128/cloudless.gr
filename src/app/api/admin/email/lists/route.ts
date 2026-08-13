import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isActiveCampaignConfigured, listACLists } from "@/lib/activecampaign";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isActiveCampaignConfigured())) {
    return NextResponse.json({
      configured: false,
      lists: [],
      total: 0,
      message:
        "ActiveCampaign is not configured. Add ACTIVECAMPAIGN_API_URL and ACTIVECAMPAIGN_API_TOKEN.",
      setupUrl: "https://www.activecampaign.com",
    });
  }

  const lists = await listACLists();
  return NextResponse.json({ configured: true, lists, total: lists.length });
}
