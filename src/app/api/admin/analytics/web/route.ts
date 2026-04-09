import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { getWebAnalytics } from "@/lib/ahrefs";
import { isConfigured } from "@/lib/integrations";

export async function GET() {
  if (!isConfigured("AHREFS_API_KEY")) {
    return NextResponse.json({ error: "Ahrefs not configured." }, { status: 503 });
  }

  try {
    const analytics = await getWebAnalytics();
    return NextResponse.json({
      analytics,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Web Analytics] Error:", err);
    return NextResponse.json({ error: "Failed to fetch analytics." }, { status: 500 });
  }
}
