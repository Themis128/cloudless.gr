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
  const DEFAULT_LIMIT = 20;
  const MAX_LIMIT = 100;
  const limit = Math.max(
    1,
    Math.min(
      Number.parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10),
      MAX_LIMIT,
    ),
  );
  const contacts = await listACContacts(limit);
  return NextResponse.json({
    contacts,
    total: contacts.length,
    fetchedAt: new Date().toISOString(),
  });
}
