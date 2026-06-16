import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  getIntegrationAnalytics,
  PostizApiError,
  PostizNotConfiguredError,
} from "@/lib/postiz";

export const dynamic = "force-dynamic";

const ALLOWED_LOOKBACK = new Set([7, 14, 30, 60, 90]);

function parseLookback(raw: string | null): 7 | 14 | 30 | 60 | 90 {
  const n = Number.parseInt(raw ?? "7", 10);
  return (ALLOWED_LOOKBACK.has(n) ? n : 7) as 7 | 14 | 30 | 60 | 90;
}

/** GET /api/admin/postiz/analytics/integration/:id?date=7 — per-channel
 *  analytics (followers, impressions, etc., shape varies by provider). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const lookback = parseLookback(new URL(req.url).searchParams.get("date"));

  try {
    const metrics = await getIntegrationAnalytics(id, lookback);
    return NextResponse.json({ metrics, lookbackDays: lookback });
  } catch (err) {
    if (err instanceof PostizNotConfiguredError) {
      return NextResponse.json({ error: "postiz_not_configured" }, { status: 503 });
    }
    if (err instanceof PostizApiError) {
      return NextResponse.json(
        { error: "postiz_upstream", status: err.status, body: err.body },
        { status: 502 }
      );
    }
    throw err;
  }
}
