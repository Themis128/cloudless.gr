import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { isHubSpotConfigured, listTickets, createTicket } from "@/lib/hubspot";
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

    const tickets = await listTickets(limit);

    return NextResponse.json({
      tickets,
      total: tickets.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[HubSpot] Error listing tickets:", err);
    return NextResponse.json({ error: "Failed to fetch tickets." }, { status: 500 });
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
    const { subject, content, hs_ticket_priority, hs_pipeline_stage } = body;

    if (!subject || typeof subject !== "string") {
      return NextResponse.json({ error: "subject is required." }, { status: 400 });
    }
    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "content is required." }, { status: 400 });
    }

    const ticket = await createTicket({
      subject,
      content,
      hs_ticket_priority,
      hs_pipeline_stage,
    });

    if (!ticket) {
      return NextResponse.json({ error: "Failed to create ticket." }, { status: 500 });
    }

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[HubSpot] Error creating ticket:", err);
    return NextResponse.json({ error: "Failed to create ticket." }, { status: 500 });
  }
}
