import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  isActiveCampaignConfigured,
  listACContacts,
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

  const { searchParams } = new URL(request.url);
  const limit = Math.max(1, Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100));
  const contacts = await listACContacts(limit);
  return NextResponse.json({
    contacts,
    total: contacts.length,
    fetchedAt: new Date().toISOString(),
  });
}
