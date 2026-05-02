import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { isHubSpotConfigured, listOwners } from "@/lib/hubspot";
import { mapIntegrationError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isHubSpotConfigured())) {
    return NextResponse.json(
      { error: "HubSpot not configured." },
      { status: 503 },
    );
  }

  try {
    const owners = await listOwners();

    return NextResponse.json({
      owners,
      total: Array.isArray(owners) ? owners.length : 0,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const _r = mapIntegrationError(err); if (_r) return _r;
    console.error("[HubSpot] Error listing owners:", err);
    return NextResponse.json(
      { error: "Failed to fetch owners." },
      { status: 500 },
    );
  }
}
