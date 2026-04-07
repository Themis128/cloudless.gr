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

    if (new Date(start) < new Date()) {
      return NextResponse.json({ error: "Cannot book a slot in the past." }, { status: 400 });
    }

    const result = await bookConsultation({ name, email, start, end, notes });

    if (!result) {
      return NextResponse.json({ error: "Failed to create booking." }, { status: 500 });
    }

    // Notify team via Slack (non-blocking)
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
    return NextResponse.json({ error: "Booking failed." }, { status: 500 });
  }
}
