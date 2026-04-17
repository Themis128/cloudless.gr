import { NextRequest, NextResponse } from "next/server";
import { getQueryPageMapping } from "@/lib/gsc";
import { getConfig } from "@/lib/ssm-config";
import { requireAdmin } from "@/lib/api-auth";

/**
 * GET /api/admin/analytics/query-pages?limit=N
 *
 * Returns query → page mappings showing which search terms land on which pages.
 * Useful for detecting keyword cannibalization and mismatched landing pages.
 * `limit` is clamped to 1–500 (default 100). Non-numeric values fall back to 100.
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

  const limit = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("limit")) || 100, 500),
  );

  try {
    const mappings = await getQueryPageMapping(undefined, limit);
    return NextResponse.json({
      mappings,
      fetchedAt: new Date().toISOString(),
      source: "google-search-console",
    });
  } catch (err) {
    console.error("[GSC query-pages] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch query-page mappings." },
      { status: 500 },
    );
  }
}
