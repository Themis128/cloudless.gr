import { NextRequest, NextResponse } from "next/server";
import { getDeviceBreakdown } from "@/lib/gsc";
import { readThrough } from "@/lib/gsc-cache";
import { getConfig } from "@/lib/ssm-config";
import { requireAdmin } from "@/lib/api-auth";

/**
 * GET /api/admin/analytics/devices
 *
 * Returns organic traffic breakdown by device type (DESKTOP, MOBILE, TABLET)
 * from Google Search Console.
 *
 * @auth Requires admin session or Bearer JWT with `admin` group (401 / 403).
 * @returns 503 if GSC credentials are not configured in SSM.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const config = await getConfig();
  if (!config.GOOGLE_CLIENT_EMAIL || !config.GOOGLE_PRIVATE_KEY) {
    return NextResponse.json({ error: "Google Search Console not configured." }, { status: 404 });
  }

  try {
    const __read = await readThrough("devices", {}, () => getDeviceBreakdown(), {
      ttlSeconds: 3600,
    });
    const devices = __read.value;
    return NextResponse.json({
      devices,
      fetchedAt: new Date().toISOString(),
      source: "google-search-console",
      _cache: { source: __read.source, ageSeconds: __read.ageSeconds },
    });
  } catch (err) {
    console.error("[GSC devices] Error:", err);
    return NextResponse.json({ error: "Failed to fetch device data." }, { status: 500 });
  }
}
