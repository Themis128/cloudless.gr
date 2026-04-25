import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isActiveCampaignConfigured, listACLists } from "@/lib/activecampaign";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isActiveCampaignConfigured())) {
    return NextResponse.json(
      { error: "ActiveCampaign not configured." },
      { status: 503 },
    );
  }

  const lists = await listACLists();
  return NextResponse.json({ lists, total: lists.length });
}
