import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  isActiveCampaignConfigured,
  listAutomations,
} from "@/lib/activecampaign";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isActiveCampaignConfigured())) {
    return NextResponse.json(
      { error: "ActiveCampaign not configured." },
      { status: 503 },
    );
  }

  const automations = await listAutomations();
  return NextResponse.json({ automations, total: automations.length });
}
