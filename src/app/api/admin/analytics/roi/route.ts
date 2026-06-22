import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { buildRoiSummary } from "@/lib/roi";

/**
 * ROI summary — ad spend (all platforms) → leads (EspoCRM) → revenue (Stripe).
 * Partial data is expected: unconfigured sources return zeros/nulls instead
 * of failing the summary, so this route never 503s.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get("days") ?? 30);
    const summary = await buildRoiSummary(days);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[ROI] summary failed:", err);
    return NextResponse.json({ error: "Failed to build ROI summary." }, { status: 500 });
  }
}
