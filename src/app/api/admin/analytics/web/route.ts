import { NextResponse } from "next/server";
import { getWebAnalytics } from "@/lib/gsc";
import { getConfig } from "@/lib/ssm-config";

export async function GET() {
  const config = await getConfig();
  if (!config.GOOGLE_CLIENT_EMAIL || !config.GOOGLE_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Google Search Console not configured." },
      { status: 503 },
    );
  }

  try {
    const analytics = await getWebAnalytics();
    return NextResponse.json({
      analytics,
      fetchedAt: new Date().toISOString(),
      source: "google-search-console",
    });
  } catch (err) {
    console.error("[Web Analytics] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch analytics." },
      { status: 500 },
    );
  }
}
