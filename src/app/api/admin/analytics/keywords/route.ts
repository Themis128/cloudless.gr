import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getTopKeywords } from "@/lib/gsc";
import { readThrough } from "@/lib/gsc-cache";
import { getConfig } from "@/lib/ssm-config";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const config = await getConfig();
  if (!config.GOOGLE_CLIENT_EMAIL || !config.GOOGLE_PRIVATE_KEY) {
    return NextResponse.json({ error: "Google Search Console not configured." }, { status: 404 });
  }

  const DEFAULT_LIMIT = 20;
  const MAX_LIMIT = 100;
  const limit = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("limit") ?? String(DEFAULT_LIMIT)), MAX_LIMIT)
  );
  const days = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("days") ?? "28"), 365 * 2)
  );

  try {
    const __read = await readThrough(
      "keywords",
      { limit, days },
      () => getTopKeywords(undefined, limit, days),
      { ttlSeconds: 3600 }
    );
    const keywords = __read.value;
    return NextResponse.json({
      keywords,
      fetchedAt: new Date().toISOString(),
      source: "google-search-console",
      _cache: { source: __read.source, ageSeconds: __read.ageSeconds },
      _filters: { days, limit },
    });
  } catch (err) {
    console.error("[GSC keywords] Error:", JSON.stringify(String((err as Error)?.message ?? err)));
    return NextResponse.json({ error: "Failed to fetch keywords." }, { status: 500 });
  }
}
