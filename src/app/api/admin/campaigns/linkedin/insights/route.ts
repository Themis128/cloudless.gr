import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isLinkedInConfigured, getLinkedInInsights } from "@/lib/campaigns/linkedin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isLinkedInConfigured())) {
    return NextResponse.json({ error: "LinkedIn not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const dateStart = searchParams.get("start") ?? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const dateEnd = searchParams.get("end") ?? new Date().toISOString().split("T")[0];

  const insights = await getLinkedInInsights(dateStart, dateEnd);
  return NextResponse.json({ insights, fetchedAt: new Date().toISOString() });
}
