import { NextResponse } from "next/server";
import { getChannelAnalytics, saAdminRoute } from "@/lib/socialauto";
import { parseAnalyticsLookback } from "@/lib/upstream-client";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/postiz/analytics/integration/:id?date=7 — per-channel
 *  analytics backed by SocialAuto `/analytics/accounts/:id/metrics`. */
export const GET = saAdminRoute<Ctx>(async (req, { params }) => {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const lookback = parseAnalyticsLookback(new URL(req.url).searchParams.get("date"));
  const metrics = await getChannelAnalytics(id, lookback);
  return NextResponse.json({ metrics, lookbackDays: lookback });
});
