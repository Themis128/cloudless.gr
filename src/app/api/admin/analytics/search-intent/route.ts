import { NextRequest, NextResponse } from "next/server";
import { getSearchIntentBreakdown } from "@/lib/gsc";
import { getConfig } from "@/lib/ssm-config";
import { requireAdmin } from "@/lib/api-auth";

/**
 * GET /api/admin/analytics/search-intent
 *
 * Returns keywords grouped by search intent: brand, product, informational, navigational.
 * Helps understand whether organic traffic is purchase-intent or browsing.
 *
 * @auth Requires Cognito JWT with `admin` group (401 / 403).
 * @returns 503 if GSC credentials are not configured in SSM.
 */
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
    const intent = await getSearchIntentBreakdown();
    return NextResponse.json({
      intent,
      summary: {
        brand: intent.brand.length,
        product: intent.product.length,
        informational: intent.informational.length,
        navigational: intent.navigational.length,
      },
      fetchedAt: new Date().toISOString(),
      source: "google-search-console",
    });
  } catch (err) {
    console.error("[GSC search-intent] Error:", err);
    return NextResponse.json({ error: "Failed to fetch search intent data." }, { status: 500 });
  }
}
