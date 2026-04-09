import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { getSeoSnapshot, getTopKeywords } from "@/lib/ahrefs";
import { isConfigured } from "@/lib/integrations";

export async function GET() {
  if (!isConfigured("AHREFS_API_KEY")) {
    return NextResponse.json({ error: "Ahrefs not configured." }, { status: 503 });
  }

  try {
    const [snapshot, keywords] = await Promise.all([
      getSeoSnapshot(),
      getTopKeywords(),
    ]);

    return NextResponse.json({
      snapshot,
      keywords,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[SEO] Error:", err);
    return NextResponse.json({ error: "Failed to fetch SEO data." }, { status: 500 });
  }
}
