import { NextResponse } from "next/server";
import { bookConsultation } from "@/lib/cal-com";
import { invalidateConsultationCache } from "@/lib/content-calendar";
import { isConfiguredAsync } from "@/lib/integrations";
import { isValidEmail } from "@/lib/validation";
import { slackBookingNotify } from "@/lib/slack-notify";
import { recordNotification } from "@/lib/admin-notifications";
import {
  upsertContact,
  createDeal,
  associateDealWithContact,
  createContactNote,
  createLead,
} from "@/lib/espocrm";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { mapIntegrationError } from "@/lib/api-errors";
import { provisionTalkRoom } from "@/lib/socialauto";

export async function POST(request: Request) {
  // Two intentional layers (not a mismatch): proxy.ts caps bursts at 3/60s,
  // while this in-route limit caps *sustained* booking abuse at 5 per 10 min
  // (tighter over a 10-min window than the proxy's burst rule).
  const ip = getClientIp(request);
  const rl = rateLimit(`calendar-book:${ip}`, 5, 10 * 60_000);
  if (!rl.ok) return rl.response;

  if (!(await isConfiguredAsync("CAL_API_KEY"))) {
    return NextResponse.json({ error: "Calendar booking is not yet available." }, { status: 503 });
  }

  try {
    const { name, email, start, end, notes, privacyConsent } = (await request.json()) as {
      name?: string;
      email?: string;
      start?: string;
      end?: string;
      notes?: string;
      privacyConsent?: boolean;
    };

    if (!name || !email || !start || !end) {
      return NextResponse.json(
        { error: "Name, email, start, and end are required." },
        { status: 400 }
      );
    }

    if (privacyConsent !== true) {
      return NextResponse.json(
        { error: "Privacy consent is required to book a consultation." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format for start or end." }, { status: 400 });
    }
    if (startDate < new Date()) {
      return NextResponse.json({ error: "Cannot book a slot in the past." }, { status: 400 });
    }
    if (endDate <= startDate) {
      return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
    }

    // Provision the Talk room BEFORE booking so the guest join link can
    // ride inside the Cal.com booking (visible on the booking page and in
    // the calendar invite) — best-effort, never blocks the booking.
    const talkRoom = await provisionTalkRoom({ name, email, start });
    const talkLink = talkRoom?.room_url ?? null;
    const bookingNotes = [
      notes ? String(notes) : "",
      talkLink ? `Join on Nextcloud Talk: ${talkLink}` : "",
    ]
      .filter(Boolean)
      .join("\n") || undefined;

    const result = await bookConsultation({ name, email, start, end, notes: bookingNotes });

    if (!result) {
      return NextResponse.json({ error: "Failed to create booking." }, { status: 500 });
    }

    invalidateConsultationCache();

    slackBookingNotify({ name, email, start, notes }).catch(() => {});

    recordNotification({
      category: "booking",
      type: "success",
      title: `New consultation booked: ${String(name)}`,
      message: `${String(name)} (${String(email)}) booked ${String(start)}`,
      actor: String(email),
      route: "/api/calendar/book",
      metadata: { start, notes: notes ? String(notes).slice(0, 500) : null },
    });

    // EspoCRM: upsert contact + create consultation deal (fire-and-forget)
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
            `Consultation booked: ${new Date(start).toLocaleString("en-IE", { timeZone: "Europe/Athens" })}`,
            ...(notes ? [`Notes: ${notes}`] : []),
            ...(talkLink ? [`Talk room: ${talkLink}`] : []),
          ];
          await createContactNote(contactId, noteLines.join("\n"));
        }
        const dealId = await createDeal({
          dealname: `Consultation – ${name} (${new Date(start).toLocaleDateString("en-IE", { timeZone: "Europe/Athens" })})`,
          dealstage: "appointmentscheduled",
          lead_source: "calendar_booking",
          closedate: new Date(start).toISOString(),
          description: notes ? `Notes: ${notes}` : undefined,
        });
        if (dealId && contactId) {
          await associateDealWithContact(dealId, contactId);
        }
        // Consult bookers also enter the Lead pipeline — SocialAuto's agency
        // triage sweep (15-min) classifies them and queues a site audit when
        // the notes carry an auditable domain.
        await createLead({
          emailAddress: email,
          firstName: firstName ?? "",
          lastName: rest.join(" ") || String(email).split("@")[0],
          source: "Web Site",
          description: [
            "lead_source: calendar_booking",
            `Consultation booked: ${new Date(start).toLocaleString("en-IE", { timeZone: "Europe/Athens" })}`,
            ...(notes ? [`Notes: ${notes}`] : []),
            ...(talkLink ? [`Talk room: ${talkLink}`] : []),
          ].join("\n"),
        });
      } catch (err) {
        const _r = mapIntegrationError(err);
        if (_r) return _r;
        console.error("[Calendar→EspoCRM] Deal creation failed:", err);
      }
    })();

    return NextResponse.json({
      success: true,
      eventId: result.eventId,
      meetingLink: result.htmlLink,
      talkLink,
    });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[Calendar] Booking error:", err);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      await import("@sentry/nextjs")
        .then(({ captureException, withScope }) =>
          withScope((scope) => {
            scope.setTag("route", "calendar.book");
            captureException(err);
          })
        )
        .catch(() => {});
    }
    return NextResponse.json({ error: "Booking failed." }, { status: 500 });
  }
}
