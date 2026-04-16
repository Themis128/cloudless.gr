import { NextRequest, NextResponse } from "next/server";
import { getDeviceBreakdown } from "@/lib/gsc";
import { getConfig } from "@/lib/ssm-config";
import { requireAdmin } from "@/lib/api-auth";

/**
 * GET /api/admin/analytics/devices
 *
 * Returns organic traffic breakdown by device type (DESKTOP, MOBILE, TABLET)
 * from Google Search Console.
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

  try {
    const devices = await getDeviceBreakdown();
    return NextResponse.json({ devices, fetchedAt: new Date().toISOString(), source: "google-search-console" });
  } catch (err) {
    console.error("[GSC devices] Error:", err);
    return NextResponse.json({ error: "Failed to fetch device data." }, { status: 500 });
  }
}
