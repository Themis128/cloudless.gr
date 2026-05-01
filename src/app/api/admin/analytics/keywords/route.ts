import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getTopKeywords } from "@/lib/gsc";
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

  const limit = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("limit") ?? "20"), 100),
  );

  try {
    const keywords = await getTopKeywords(undefined, limit);
    return NextResponse.json({
      keywords,
      fetchedAt: new Date().toISOString(),
      source: "google-search-console",
    });
  } catch (err) {
    console.error("[GSC keywords] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch keywords." },
      { status: 500 },
    );
  }
}
