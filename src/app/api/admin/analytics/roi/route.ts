import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getRoiFromLake } from "@/lib/datalake-serve";

/**
 * ROI summary — lake gold (LinkedIn ads + stripe_revenue).
 * Other ad channels report configured=false until silver ETL lands.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get("days") ?? 30);
    const summary = await getRoiFromLake(days);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[ROI] lake summary failed:", err);
    return NextResponse.json(
      { error: "Failed to build ROI summary from datalake." },
      { status: 500 }
    );
  }
}
