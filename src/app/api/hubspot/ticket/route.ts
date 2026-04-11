import { NextRequest, NextResponse } from "next/server";
import { createTicket, searchContacts } from "@/lib/hubspot";

/**
 * POST /api/hubspot/ticket
 *
 * Creates a support ticket in HubSpot.
 * Optionally associates it with a contact by email.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { subject, content, email, priority } = body;
    if (!subject || !content) {
      return NextResponse.json(
        { error: "Missing required fields: subject, content" },
        { status: 400 },
      );
    }

    // Find contact by email if provided
    let contactId: string | undefined;
    if (email) {
      try {
        const result = await searchContacts("email", email);
        if (result.total > 0) {
          contactId = result.results[0].id;
        }
      } catch {
        // Contact not found — ticket will be unassociated
      }
    }

    const ticket = await createTicket(
      {
        subject,
        content,
        hs_ticket_priority: priority || "MEDIUM",
      },
      contactId,
    );

    if (!ticket) {
      return NextResponse.json(
        { error: "HubSpot ticket creation is not configured." },
        { status: 503 },
      );
    }

    console.warn("[HubSpot] Ticket created:", ticket.id);

    return NextResponse.json({
      success: true,
      ticketId: ticket.id,
      contactId: contactId || null,
    });
  } catch (error) {
    console.error("[HubSpot] Ticket error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to create ticket.", detail: errMsg },
      { status: 500 },
    );
  }
}
