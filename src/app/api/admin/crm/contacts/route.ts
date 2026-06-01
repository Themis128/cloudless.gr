import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { isConfiguredAsync } from "@/lib/integrations";
import { listContacts, upsertContact } from "@/lib/hubspot";
import { mapIntegrationError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  if (!(await isConfiguredAsync("HUBSPOT_API_KEY"))) {
    return NextResponse.json({ error: "HubSpot not configured." }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

    const contacts = await listContacts(limit);

    return NextResponse.json({
      contacts,
      total: contacts.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[HubSpot] Error listing contacts:", err);
    return NextResponse.json({ error: "Failed to fetch contacts." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  if (!(await isConfiguredAsync("HUBSPOT_API_KEY"))) {
    return NextResponse.json({ error: "HubSpot not configured." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { email, firstname, lastname, company, phone, service_interest, lead_source } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "email is required." }, { status: 400 });
    }

    const id = await upsertContact({
      email,
      firstname,
      lastname,
      company,
      service_interest,
      lead_source,
    });

    if (!id) {
      return NextResponse.json({ error: "Failed to create contact." }, { status: 500 });
    }

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[HubSpot] Error creating contact:", err);
    return NextResponse.json({ error: "Failed to create contact." }, { status: 500 });
  }
}
