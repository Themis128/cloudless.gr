import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getFunnelSummary } from "@/lib/search-funnel";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const daysRaw = new URL(request.url).searchParams.get("days");
  const days = Math.max(1, Math.min(90, Number.parseInt(daysRaw || "30", 10) || 30));
  const rows = await getFunnelSummary(days);

  if (rows === null) {
    return NextResponse.json(
      {
        configured: false,
        days,
        rows: [],
        message: "D1 AUTH_DB not bound — run migration 0008 on user-auth-db",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ configured: true, days, rows });
}
