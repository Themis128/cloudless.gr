import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isHubSpotConfigured, getDeal, updateDeal, deleteDeal } from "@/lib/hubspot";
import { mapIntegrationError } from "@/lib/api-errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  if (!(await isHubSpotConfigured())) {
    return NextResponse.json({ error: "HubSpot not configured." }, { status: 503 });
  }

  const { id } = await params;
  try {
    const deal = await getDeal(id);
    if (!deal) {
      return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    }
    return NextResponse.json({ deal });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[HubSpot] Error fetching deal:", err);
    return NextResponse.json({ error: "Failed to fetch deal." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  if (!(await isHubSpotConfigured())) {
    return NextResponse.json({ error: "HubSpot not configured." }, { status: 503 });
  }

  const { id } = await params;
  try {
    const data = await request.json();
    const deal = await updateDeal(id, data);
    if (!deal) {
      return NextResponse.json({ error: "Failed to update deal." }, { status: 500 });
    }
    return NextResponse.json({ deal });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[HubSpot] Error updating deal:", err);
    return NextResponse.json({ error: "Failed to update deal." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  if (!(await isHubSpotConfigured())) {
    return NextResponse.json({ error: "HubSpot not configured." }, { status: 503 });
  }

  const { id } = await params;
  try {
    const ok = await deleteDeal(id);
    if (!ok) {
      return NextResponse.json({ error: "Failed to delete deal." }, { status: 500 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[HubSpot] Error deleting deal:", err);
    return NextResponse.json({ error: "Failed to delete deal." }, { status: 500 });
  }
}
