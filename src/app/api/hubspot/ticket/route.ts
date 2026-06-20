import { NextRequest, NextResponse } from "next/server";
import { isHubSpotConfigured, createTicket, searchContacts } from "@/lib/hubspot";
import { isValidEmail } from "@/lib/validation";
import { mapIntegrationError } from "@/lib/api-errors";
import { slackTicketNotify } from "@/lib/slack-notify";
import { notifyTeam } from "@/lib/email";

const VALID_PRIORITIES = new Set(["HIGH", "MEDIUM", "LOW"]);

function parseTicketBody(body: Record<string, unknown>): {
  subject: string;
  content: string;
  email: string | undefined;
  normalizedPriority: string;
} | null {
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : "";
  const content = typeof body.content === "string" ? body.content.trim().slice(0, 2000) : "";
  if (!subject || !content) return null;
  const email = typeof body.email === "string" ? body.email : undefined;
  const rawPriority = typeof body.priority === "string" ? body.priority : "";
  const normalizedPriority = VALID_PRIORITIES.has(rawPriority.toUpperCase())
    ? rawPriority.toUpperCase()
    : "MEDIUM";
  return { subject, content, email, normalizedPriority };
}

async function resolveContactId(
  email: string
): Promise<{ contactId: string | undefined; integrationError: NextResponse | null }> {
  try {
    const result = await searchContacts("email", email);
    const contactId = result.total > 0 ? result.results[0].id : undefined;
    return { contactId, integrationError: null };
  } catch (err) {
    const integrationError = mapIntegrationError(err);
    return { contactId: undefined, integrationError: integrationError ?? null };
  }
}

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
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = parseTicketBody(body as Record<string, unknown>);

    if (!parsed) {
      return NextResponse.json(
        { error: "Missing required fields: subject, content" },
        { status: 400 }
      );
    }

    const { subject, content, email, normalizedPriority } = parsed;

    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    // Find contact by email if provided
    let contactId: string | undefined;
    if (email) {
      const resolved = await resolveContactId(email);
      if (resolved.integrationError) return resolved.integrationError;
      contactId = resolved.contactId;
    }

    const ticket = await createTicket(
      { subject, content, hs_ticket_priority: normalizedPriority },
      contactId
    );

    if (!ticket) {
      return NextResponse.json(
        { error: "HubSpot ticket creation is not configured." },
        { status: 503 }
      );
    }

    // Notify team via Slack + SES
    slackTicketNotify({ subject, email, priority: normalizedPriority }).catch(() => {});
    notifyTeam(
      `Support Ticket: ${subject}`,
      `Priority: ${normalizedPriority}\nEmail: ${email ?? "N/A"}\n\n${content.slice(0, 500)}`
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      ticketId: ticket.id,
      contactId: contactId || null,
    });
  } catch (error) {
    const _r = mapIntegrationError(error);
    if (_r) return _r;
    console.error("[HubSpot] Ticket error:", error);
    return NextResponse.json({ error: "Failed to create ticket." }, { status: 500 });
  }
}
