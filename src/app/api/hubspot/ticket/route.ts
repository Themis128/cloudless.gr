import { NextRequest, NextResponse } from "next/server";
import {
  isHubSpotConfigured,
  createTicket,
  searchContacts,
} from "@/lib/hubspot";
import { isValidEmail } from "@/lib/validation";

/**
 * POST /api/hubspot/ticket
 *
 * Creates a support ticket in HubSpot.
 * Optionally associates it with a contact by email.
 */
export async function POST(request: NextRequest) {
  if (!(await isHubSpotConfigured())) {
    return NextResponse.json(
      { error: "HubSpot ticket creation is not configured." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();

    const rawSubject =
      typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : "";
    const rawContent =
      typeof body.content === "string"
        ? body.content.trim().slice(0, 2000)
        : "";
    const { email, priority } = body;
    const subject = rawSubject;
    const content = rawContent;
    if (!subject || !content) {
      return NextResponse.json(
        { error: "Missing required fields: subject, content" },
        { status: 400 },
      );
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 },
      );
    }

    // Normalize priority — only HIGH/MEDIUM/LOW are valid HubSpot values
    const VALID_PRIORITIES = ["HIGH", "MEDIUM", "LOW"];
    const normalizedPriority = VALID_PRIORITIES.includes(
      (priority || "").toUpperCase(),
    )
      ? (priority as string).toUpperCase()
      : "MEDIUM";

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
        hs_ticket_priority: normalizedPriority,
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
