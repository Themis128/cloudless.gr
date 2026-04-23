import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isXConfigured, getXStats } from "@/lib/campaigns/x-ads";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isXConfigured())) {
    return NextResponse.json({ error: "X (Twitter) not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const dateStart = searchParams.get("start") ?? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const dateEnd = searchParams.get("end") ?? new Date().toISOString().split("T")[0];

  const stats = await getXStats(dateStart, dateEnd);
  return NextResponse.json({ stats, fetchedAt: new Date().toISOString() });
}
