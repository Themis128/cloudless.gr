import { NextResponse } from "next/server";
import { upsertContact } from "@/lib/hubspot";
import { isConfigured } from "@/lib/integrations";
import { isValidEmail } from "@/lib/validation";

export async function POST(request: Request) {
  if (!isConfigured("HUBSPOT_API_KEY")) {
    return NextResponse.json({ error: "CRM not configured." }, { status: 503 });
  }

  try {
    const { email, firstname, lastname, company, service_interest, message, lead_source } =
      await request.json();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    const contactId = await upsertContact({
      email,
      firstname,
      lastname,
      company,
      service_interest,
      message,
      lead_source,
    });

    if (!contactId) {
      return NextResponse.json({ error: "Failed to create contact." }, { status: 500 });
    }

    return NextResponse.json({ success: true, contactId });
  } catch (err) {
    console.error("[CRM] Error:", err);
    return NextResponse.json({ error: "CRM operation failed." }, { status: 500 });
  }
}
