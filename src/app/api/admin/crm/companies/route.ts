import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { isHubSpotConfigured, listCompanies, createCompany } from "@/lib/hubspot";
import { mapIntegrationError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isHubSpotConfigured())) {
    return NextResponse.json({ error: "HubSpot not configured." }, { status: 503 });
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
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[HubSpot] Error listing companies:", err);
    return NextResponse.json({ error: "Failed to fetch companies." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isHubSpotConfigured())) {
    return NextResponse.json({ error: "HubSpot not configured." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { name, domain, city, country, phone, industry } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required." }, { status: 400 });
    }

    const id = await createCompany({ name, domain, city, country, phone, industry });

    if (!id) {
      return NextResponse.json({ error: "Failed to create company." }, { status: 500 });
    }

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[HubSpot] Error creating company:", err);
    return NextResponse.json({ error: "Failed to create company." }, { status: 500 });
  }
}
