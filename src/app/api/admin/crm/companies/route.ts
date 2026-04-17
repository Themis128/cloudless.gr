import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { isHubSpotConfigured, listCompanies } from "@/lib/hubspot";

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
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get("limit") ?? 20);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100)
      : 20;

    const companies = await listCompanies(limit);

    return NextResponse.json({
      companies,
      total: companies.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[HubSpot] Error listing companies:", err);
    return NextResponse.json(
      { error: "Failed to fetch companies." },
      { status: 500 },
    );
  }
}
