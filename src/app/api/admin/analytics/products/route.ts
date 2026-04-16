import { NextRequest, NextResponse } from "next/server";
import { getProductPageMetrics } from "@/lib/gsc";
import { getConfig } from "@/lib/ssm-config";
import { requireAdmin } from "@/lib/api-auth";

/**
 * GET /api/admin/analytics/products?limit=N&pattern=/store/
 *
 * Returns product page performance metrics from Google Search Console.
 * Filters pages by URL pattern (default: "/store/").
 * `limit` is clamped to 1–100 (default 50). Non-numeric values fall back to 50.
 *
 * @auth Requires Cognito JWT with `admin` group (401 / 403).
 * @returns 503 if GSC credentials are not configured in SSM.
 */
export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const config = await getConfig();
  if (!config.GOOGLE_CLIENT_EMAIL || !config.GOOGLE_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Google Search Console not configured." },
      { status: 503 },
    );
  }

  const limit = Math.max(1, Math.min(Number(request.nextUrl.searchParams.get("limit")) || 50, 100));
  const pattern = request.nextUrl.searchParams.get("pattern") || "/store/";

  try {
    const products = await getProductPageMetrics(undefined, pattern, limit);
    return NextResponse.json({ products, pattern, fetchedAt: new Date().toISOString(), source: "google-search-console" });
  } catch (err) {
    console.error("[GSC products] Error:", err);
    return NextResponse.json({ error: "Failed to fetch product data." }, { status: 500 });
  }
}
