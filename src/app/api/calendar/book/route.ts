import { NextResponse } from "next/server";
import { bookConsultation } from "@/lib/google-calendar";
import { isConfigured } from "@/lib/integrations";
import { isValidEmail } from "@/lib/validation";
import { slackNotify } from "@/lib/slack-notify";

export async function POST(request: Request) {
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

    const result = await bookConsultation({ name, email, start, end, notes });

    if (!result) {
      return NextResponse.json({ error: "Failed to create booking." }, { status: 500 });
    }

    slackNotify({
      text: `\ud83d\udcc5 New consultation booked: ${name} (${email}) at ${new Date(start).toLocaleString("en-IE")}`,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      eventId: result.eventId,
      meetingLink: result.htmlLink,
    });
  } catch (err) {
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
