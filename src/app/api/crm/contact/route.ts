import { NextResponse } from "next/server";
import { isHubSpotConfigured, upsertContact } from "@/lib/hubspot";
import { isValidEmail } from "@/lib/validation";

export async function POST(request: Request) {
  if (!await isHubSpotConfigured()) {
    return NextResponse.json({ error: "CRM not configured." }, { status: 503 });
  }

  try {
    const {
      email,
      firstname,
      lastname,
      company,
      service_interest,
      message,
      lead_source,
    } = await request.json();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    // Sanitize and length-cap all string fields before sending to HubSpot
    const clean = (v: unknown, max: number): string | undefined =>
      typeof v === "string" ? v.trim().slice(0, max) || undefined : undefined;

    const safeFirstname = clean(firstname, 100);
    const safeLastname  = clean(lastname,  100);
    const safeCompany   = clean(company,   200);
    const safeService   = clean(service_interest, 100);
    const safeMessage   = clean(message,   1000);
    const safeSource    = clean(lead_source, 100);

    const contactId = await upsertContact({
      email,
      firstname:        safeFirstname,
      lastname:         safeLastname,
      company:          safeCompany,
      service_interest: safeService,
      message:          safeMessage,
      lead_source:      safeSource,
    });

    if (!contactId) {
      return NextResponse.json(
        { error: "Failed to create contact." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, contactId });
  } catch (err) {
    console.error("[CRM] Error:", err);
    return NextResponse.json(
      { error: "CRM operation failed." },
      { status: 500 },
    );
  }
}
