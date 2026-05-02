import { NextResponse } from "next/server";
import { bookConsultation } from "@/lib/google-calendar";
import { isConfigured } from "@/lib/integrations";
import { isValidEmail } from "@/lib/validation";
import { slackBookingNotify } from "@/lib/slack-notify";
import {
  upsertContact,
  createDeal,
  associateDealWithContact,
  createContactNote,
} from "@/lib/hubspot";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { mapIntegrationError } from "@/lib/api-errors";

export async function POST(request: Request) {
  // Rate limit: 5 booking attempts per IP per 10 minutes
  const ip = getClientIp(request);
  const rl = rateLimit(`calendar-book:${ip}`, 5, 10 * 60_000);
  if (!rl.ok) return rl.response;

  if (!isConfigured("GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY")) {
    return NextResponse.json(
      { error: "Calendar booking is not yet available." },
      { status: 503 },
    );
  }

  try {
    const { name, email, start, end, notes } = await request.json();

    if (!name || !email || !start || !end) {
      return NextResponse.json(
        { error: "Name, email, start, and end are required." },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 },
      );
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format for start or end." },
        { status: 400 },
      );
    }
    if (startDate < new Date()) {
      return NextResponse.json(
        { error: "Cannot book a slot in the past." },
        { status: 400 },
      );
    }
    if (endDate <= startDate) {
      return NextResponse.json(
        { error: "End time must be after start time." },
        { status: 400 },
      );
    }

    const result = await bookConsultation({ name, email, start, end, notes });

    if (!result) {
      return NextResponse.json(
        { error: "Failed to create booking." },
        { status: 500 },
      );
    }

    slackBookingNotify({ name, email, start, notes }).catch(() => {});

    // HubSpot: upsert contact + create consultation deal (fire-and-forget)
    (async () => {
      try {
        const [firstName, ...rest] = (name as string).trim().split(" ");
        const contactId = await upsertContact({
          email,
          firstname: firstName ?? "",
          lastname: rest.join(" "),
          lead_source: "calendar_booking",
        });
        if (contactId) {
          const noteLines = [
            `Consultation booked: ${new Date(start).toLocaleString("en-IE")}`,
            ...(notes ? [`Notes: ${notes}`] : []),
          ];
          await createContactNote(contactId, noteLines.join("\n"));
        }
        const dealId = await createDeal({
          dealname: `Consultation – ${name} (${new Date(start).toLocaleDateString("en-IE")})`,
          dealstage: "appointmentscheduled",
          lead_source: "calendar_booking",
          closedate: new Date(start).toISOString(),
          description: notes ? `Notes: ${notes}` : undefined,
        });
        if (dealId && contactId) {
          await associateDealWithContact(dealId, contactId);
        }
      } catch (err) {
    const _r = mapIntegrationError(err); if (_r) return _r;
        console.error("[Calendar→HubSpot] Deal creation failed:", err);
      }
    })();

    return NextResponse.json({
      success: true,
      eventId: result.eventId,
      meetingLink: result.htmlLink,
    });
  } catch (err) {
    const _r = mapIntegrationError(err); if (_r) return _r;
    console.error("[Calendar] Booking error:", err);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      await import("@sentry/nextjs")
        .then(({ captureException, withScope }) =>
          withScope((scope) => {
            scope.setTag("route", "calendar.book");
            captureException(err);
          }),
        )
        .catch(() => {});
    }
    return NextResponse.json({ error: "Booking failed." }, { status: 500 });
  }
}
