import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  isActiveCampaignConfigured,
  listCampaigns,
  createCampaign,
  type CreateCampaignInput,
} from "@/lib/activecampaign";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isActiveCampaignConfigured())) {
    return NextResponse.json({ error: "ActiveCampaign not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const campaigns = await listCampaigns(limit);
  return NextResponse.json({ campaigns, total: campaigns.length, fetchedAt: new Date().toISOString() });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isActiveCampaignConfigured())) {
    return NextResponse.json({ error: "ActiveCampaign not configured." }, { status: 503 });
  }

  let input: CreateCampaignInput;
  try {
    input = await request.json();
    if (!input.name || !input.subject || !input.listId) throw new Error("missing fields");
  } catch {
    return NextResponse.json({ error: "name, subject, listId are required." }, { status: 400 });
  }

  const campaign = await createCampaign(input);
  if (!campaign) {
    return NextResponse.json({ error: "Failed to create campaign." }, { status: 500 });
  }
  return NextResponse.json({ campaign }, { status: 201 });
}
