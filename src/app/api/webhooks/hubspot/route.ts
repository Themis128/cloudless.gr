import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getIntegrationsAsync } from "@/lib/integrations";

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000; // reject requests older than 5 min

type HubSpotEvent = {
  eventId: number;
  subscriptionId: number;
  portalId: number;
  occurredAt: number;
  subscriptionType: string;
  objectId: number;
  propertyName?: string;
  propertyValue?: string;
  changeSource?: string;
};

async function verifySignatureV3(
  request: NextRequest,
  body: string,
  clientSecret: string,
): Promise<boolean> {
  const signature = request.headers.get("x-hubspot-signature-v3");
  const timestamp = request.headers.get("x-hubspot-signature-timestamp");

  if (!signature || !timestamp) return false;

  const age = Date.now() - Number(timestamp);
  if (isNaN(age) || age > MAX_TIMESTAMP_AGE_MS || age < 0) return false;

  const input = `${request.method}${request.url}${body}${timestamp}`;
  const expected = createHmac("sha256", clientSecret)
    .update(input)
    .digest("base64");

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const cfg = await getIntegrationsAsync();
  const clientSecret = cfg.HUBSPOT_CLIENT_SECRET;

  if (clientSecret) {
    const valid = await verifySignatureV3(request, rawBody, clientSecret);
    if (!valid) {
      console.warn("[HubSpot Webhook] Signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    console.warn(
      "[HubSpot Webhook] HUBSPOT_CLIENT_SECRET not set — skipping signature check",
    );
  }

  let events: HubSpotEvent[];
  try {
    const parsed = JSON.parse(rawBody);
    events = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  for (const event of events) {
    const { subscriptionType, objectId, propertyName, propertyValue, occurredAt } =
      event;

    console.warn(
      `[HubSpot Webhook] ${subscriptionType} | object=${objectId} | t=${occurredAt}`,
      propertyName ? { propertyName, propertyValue } : undefined,
    );
  }

  return NextResponse.json({ received: events.length });
}

// HubSpot sends a GET to verify the webhook URL during setup
export async function GET() {
  return NextResponse.json({ ok: true });
}
