import { NextRequest, NextResponse } from "next/server";
import { getCtrOpportunities } from "@/lib/gsc";
import { readThrough } from "@/lib/gsc-cache";
import { getConfig } from "@/lib/ssm-config";
import { requireAdmin } from "@/lib/api-auth";

/**
 * GET /api/admin/analytics/ctr-opportunities?limit=N
 *
 * Returns keywords ranking position 4–20 with high impressions but low CTR (<5%).
 * These are optimization opportunities where improving titles/meta descriptions
 * could increase organic traffic.
 * `limit` is clamped to 1–200 (default 50). Non-numeric values fall back to 50.
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

  const limit = Math.max(1, Math.min(Number(request.nextUrl.searchParams.get("limit")) || 50, 200));

  try {
    const __read = await readThrough(
      "ctr-opportunities",
      { limit: limit },
      () => getCtrOpportunities(undefined, limit),
      { ttlSeconds: 3600 }
    );
    const opportunities = __read.value;
    return NextResponse.json({
      opportunities,
      fetchedAt: new Date().toISOString(),
      source: "google-search-console",
      _cache: { source: __read.source, ageSeconds: __read.ageSeconds },
    });
  } catch (err) {
    console.error("[GSC CTR opportunities] Error:", err);
    return NextResponse.json({ error: "Failed to fetch CTR opportunities." }, { status: 500 });
  }
}
