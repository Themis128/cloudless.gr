import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isHubSpotConfigured, getPipelineStats } from "@/lib/hubspot";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isHubSpotConfigured())) {
    return NextResponse.json({ error: "HubSpot not configured." }, { status: 503 });
  }

  try {
    const stats = await getPipelineStats();
    return NextResponse.json({ ...stats, fetchedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "Failed to fetch pipeline stats." }, { status: 500 });
  }
}
