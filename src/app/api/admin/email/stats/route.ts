import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isHubSpotConfigured, listNewsletterSubscribers } from "@/lib/espocrm";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isHubSpotConfigured())) {
    return NextResponse.json({ error: "HubSpot not configured." }, { status: 503 });
  }

  const subscribers = await listNewsletterSubscribers();
  return NextResponse.json({
    totalSubscribers: subscribers.length,
    fetchedAt: new Date().toISOString(),
  });
}
