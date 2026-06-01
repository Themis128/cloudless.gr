import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isHubSpotConfigured, updateTicket, deleteTicket } from "@/lib/hubspot";
import { mapIntegrationError } from "@/lib/api-errors";

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
    const ticket = await updateTicket(id, data);
    if (!ticket) {
      return NextResponse.json({ error: "Failed to update ticket." }, { status: 500 });
    }
    return NextResponse.json({ ticket });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[HubSpot] Error updating ticket:", err);
    return NextResponse.json({ error: "Failed to update ticket." }, { status: 500 });
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
    const ok = await deleteTicket(id);
    if (!ok) {
      return NextResponse.json({ error: "Failed to delete ticket." }, { status: 500 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[HubSpot] Error deleting ticket:", err);
    return NextResponse.json({ error: "Failed to delete ticket." }, { status: 500 });
  }
}
