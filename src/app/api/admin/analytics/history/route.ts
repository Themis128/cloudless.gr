import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getPerformanceHistory } from "@/lib/gsc";
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

  const DEFAULT_WEEKS = 12;
  const MAX_WEEKS = 52;
  const weeks = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("weeks") ?? String(DEFAULT_WEEKS)), MAX_WEEKS),
  );

  try {
    const history = await getPerformanceHistory(undefined, weeks);
    return NextResponse.json({
      history,
      weeks,
      fetchedAt: new Date().toISOString(),
      source: "google-search-console",
    });
  } catch (err) {
    console.error("[GSC history] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch history." },
      { status: 500 },
    );
  }
}
