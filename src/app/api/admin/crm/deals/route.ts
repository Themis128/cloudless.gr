import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { isHubSpotConfigured, listDeals, createDeal } from "@/lib/hubspot";
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

    const deals = await listDeals(limit);

    return NextResponse.json({
      deals,
      total: deals.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[HubSpot] Error listing deals:", err);
    return NextResponse.json({ error: "Failed to fetch deals." }, { status: 500 });
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
    const {
      dealname,
      amount,
      currency,
      dealstage,
      pipeline,
      closedate,
      description,
      service_interest,
      hubspot_owner_id,
    } = body;

    if (!dealname || typeof dealname !== "string") {
      return NextResponse.json({ error: "dealname is required." }, { status: 400 });
    }

    const id = await createDeal({
      dealname,
      amount: amount !== undefined ? Number(amount) : undefined,
      currency,
      dealstage,
      pipeline,
      closedate,
      description,
      service_interest,
    });

    if (!id) {
      return NextResponse.json({ error: "Failed to create deal." }, { status: 500 });
    }

    return NextResponse.json({ id, hubspot_owner_id }, { status: 201 });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[HubSpot] Error creating deal:", err);
    return NextResponse.json({ error: "Failed to create deal." }, { status: 500 });
  }
}
