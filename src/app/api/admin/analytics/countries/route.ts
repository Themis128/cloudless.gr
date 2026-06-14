import { NextRequest, NextResponse } from "next/server";
import { getTrafficByCountry } from "@/lib/gsc";
import { readThrough } from "@/lib/gsc-cache";
import { getConfig } from "@/lib/ssm-config";
import { requireAdmin } from "@/lib/api-auth";

/**
 * GET /api/admin/analytics/countries?limit=N
 *
 * Returns organic traffic breakdown by country from Google Search Console.
 * `limit` is clamped to 1–50 (default 30). Non-numeric values fall back to 30.
 *
 * @auth Requires admin session or Bearer JWT with `admin` group (401 / 403).
 * @returns 503 if GSC credentials are not configured in SSM.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const config = await getConfig();
  if (!config.GOOGLE_CLIENT_EMAIL || !config.GOOGLE_PRIVATE_KEY) {
    return NextResponse.json({ error: "Google Search Console not configured." }, { status: 503 });
  }

  const limit = Math.max(1, Math.min(Number(request.nextUrl.searchParams.get("limit")) || 30, 50));

  try {
    const __read = await readThrough(
      "countries",
      { limit: limit },
      () => getTrafficByCountry(undefined, limit),
      { ttlSeconds: 3600 }
    );
    const countries = __read.value;
    return NextResponse.json({
      countries,
      fetchedAt: new Date().toISOString(),
      source: "google-search-console",
      _cache: { source: __read.source, ageSeconds: __read.ageSeconds },
    });
  } catch (err) {
    console.error("[GSC countries] Error:", err);
    return NextResponse.json({ error: "Failed to fetch country data." }, { status: 500 });
  }
}
