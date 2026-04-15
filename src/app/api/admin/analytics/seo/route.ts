import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getSeoSnapshot, getTopKeywords } from "@/lib/gsc";
import { getConfig } from "@/lib/ssm-config";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const config = await getConfig();
  if (!config.GOOGLE_CLIENT_EMAIL || !config.GOOGLE_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Google Search Console not configured." },
      { status: 503 },
    );
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
      source: "google-search-console",
    });
  } catch (err) {
    console.error("[SEO] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch SEO data." },
      { status: 500 },
    );
  }
}
