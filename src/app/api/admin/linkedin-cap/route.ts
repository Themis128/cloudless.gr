// R20/R26: LinkedIn Conversion API endpoint
// Captures conversions server-side for better attribution

const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN || "";
const LINKEDIN_CONVERSION_ID = process.env.LINKEDIN_CONVERSION_ID || "";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();

  const { email, firstName, lastName, eventId, conversionId } = body as {
    email?: string;
    firstName?: string;
    lastName?: string;
    eventId?: string;
    conversionId?: string;
  };

  if (!eventId) {
    return Response.json({ error: "eventId required" }, { status: 400 });
  }

  if (!LINKEDIN_ACCESS_TOKEN) {
    return Response.json({ error: "LinkedIn CAPI not configured" }, { status: 503 });
  }

  try {
    const response = await fetch(
      `https://api.linkedin.com/v2/leadNotifications?q=conversionRegistration&conversionRegistrationId=${conversionId || LINKEDIN_CONVERSION_ID}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-RestLi-Method": "BATCH_PARTIAL_UPDATE",
        },
        body: JSON.stringify({
          elements: [{
            conversion: `urn:lla:linkedin.com:conversion:${conversionId || LINKEDIN_CONVERSION_ID}`,
            eventId: eventId,
            ...(email ? { email } : {}),
            ...(firstName || lastName ? {
              userData: {
                ...(firstName ? { firstName } : {}),
                ...(lastName ? { lastName } : {}),
              },
            } : {}),
          }],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[linkedin-cap] CAPI request failed:", error);
      return Response.json({ error: "CAPI request failed" }, { status: 500 });
    }

    return Response.json({ success: true, eventId });
  } catch (err) {
    console.error("[linkedin-cap] Unexpected error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}