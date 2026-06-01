import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isConfiguredAsync } from "@/lib/integrations";
import { updateContact, deleteContact } from "@/lib/hubspot";
import { mapIntegrationError } from "@/lib/api-errors";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  if (!(await isConfiguredAsync("HUBSPOT_API_KEY"))) {
    return NextResponse.json({ error: "HubSpot not configured." }, { status: 503 });
  }

  const { id } = await params;
  try {
    const data = await request.json();
    const contact = await updateContact(id, data);
    if (!contact) {
      return NextResponse.json({ error: "Failed to update contact." }, { status: 500 });
    }
    return NextResponse.json({ contact });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[HubSpot] Error updating contact:", err);
    return NextResponse.json({ error: "Failed to update contact." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  if (!(await isConfiguredAsync("HUBSPOT_API_KEY"))) {
    return NextResponse.json({ error: "HubSpot not configured." }, { status: 503 });
  }

  const { id } = await params;
  try {
    const ok = await deleteContact(id);
    if (!ok) {
      return NextResponse.json({ error: "Failed to delete contact." }, { status: 500 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[HubSpot] Error deleting contact:", err);
    return NextResponse.json({ error: "Failed to delete contact." }, { status: 500 });
  }
}
