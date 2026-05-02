import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getIntegrationsAsync } from "@/lib/integrations";
import { SlackClient } from "@/lib/slack-notify";

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;
const HUBSPOT_API = "https://api.hubapi.com";
const PORTAL_BASE = "https://app-eu1.hubspot.com/contacts/147639927";
const PLAIN_TEXT = "plain_text";
const SECTION = "section";
const CONTEXT = "context";
const OPEN_IN_HUBSPOT = "Open in HubSpot";
const CRM_BOT_NAME = "Cloudless CRM";

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
  if (Number.isNaN(age) || age > MAX_TIMESTAMP_AGE_MS || age < 0) return false;
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

async function fetchObject(
  token: string,
  objectType: string,
  objectId: number,
  properties: string[],
): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(
      `${HUBSPOT_API}/crm/v3/objects/${objectType}/${objectId}?properties=${properties.join(",")}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.properties ?? {}) as Record<string, string>;
  } catch {
    return null;
  }
}

function ts(): number {
  return Math.floor(Date.now() / 1000);
}

function viewButton(label: string, url: string) {
  return {
    type: "button",
    text: { type: PLAIN_TEXT, text: label },
    url,
  };
}

const slack = new SlackClient();

async function onContactCreated(token: string, id: number): Promise<void> {
  const p = await fetchObject(token, "contacts", id, [
    "email",
    "firstname",
    "lastname",
    "company",
    "service_interest",
    "hs_lead_status",
  ]);

  const name =
    [p?.firstname, p?.lastname].filter(Boolean).join(" ") || "Unknown";
  const email = p?.email ?? "—";
  const company = p?.company || "—";
  const service = p?.service_interest || "—";

  await slack.post({
    text: `New contact: ${name} (${email})`,
    blocks: [

      {
        type: "header",
        text: { type: PLAIN_TEXT, text: "New Contact", emoji: true },
      },
      {
        type: SECTION,
        text: {
          type: "mrkdwn",
          text: [
            `*Name:* ${name}`,
            `*Email:* ${email}`,
            `*Company:* ${company}`,
            `*Service:* ${service}`,
          ].join("\n"),
        },
        accessory: viewButton(
          OPEN_IN_HUBSPOT,
          `${PORTAL_BASE}/contact/${id}`,
        ),
      },
      {
        type: CONTEXT,
        elements: [
          {
            type: "mrkdwn",
            text: `<!date^${ts()}^{date_short_pretty} at {time}|now>`,
          },
          { type: "mrkdwn", text: "HubSpot · contact.creation" },
        ],
      },
    ],
    icon_emoji: ":bust_in_silhouette:",
    username: CRM_BOT_NAME,
  });
}

async function onDealCreated(token: string, id: number): Promise<void> {
  const p = await fetchObject(token, "deals", id, [
    "dealname",
    "amount",
    "dealstage",
    "lead_source",
  ]);

  const name = p?.dealname ?? "Untitled Deal";
  const amount = p?.amount
    ? `€${Number.parseFloat(p.amount).toLocaleString("en-IE")}`
    : "—";
  const stage = p?.dealstage ?? "—";

  await slack.post({
    text: `New deal: ${name} (${amount})`,
    blocks: [
      {
        type: "header",
        text: { type: PLAIN_TEXT, text: "New Deal", emoji: true },
      },
      {
        type: SECTION,
        text: {
          type: "mrkdwn",
          text: [
            `*Deal:* ${name}`,
            `*Amount:* ${amount}`,
            `*Stage:* \`${stage}\``,
          ].join("\n"),
        },
        accessory: viewButton(OPEN_IN_HUBSPOT, `${PORTAL_BASE}/deal/${id}`),
      },
      {
        type: CONTEXT,
        elements: [
          {
            type: "mrkdwn",
            text: `<!date^${ts()}^{date_short_pretty} at {time}|now>`,
          },
          { type: "mrkdwn", text: "HubSpot · deal.creation" },
        ],
      },
    ],
    icon_emoji: ":handshake:",
    username: CRM_BOT_NAME,
  });
}

async function onDealClosedWon(token: string, id: number): Promise<void> {
  const p = await fetchObject(token, "deals", id, ["dealname", "amount"]);

  const name = p?.dealname ?? "Untitled Deal";
  const amount = p?.amount
    ? `€${Number.parseFloat(p.amount).toLocaleString("en-IE")}`
    : "";
  const closedWonText = amount ? `Deal closed won: ${name} — ${amount}` : `Deal closed won: ${name}`;

  await slack.post({
    text: closedWonText,
    blocks: [
      {
        type: "header",
        text: { type: PLAIN_TEXT, text: "Deal Closed Won!", emoji: true },
      },
      {
        type: SECTION,
        text: {
          type: "mrkdwn",
          text: [`*Deal:* ${name}`, amount ? `*Amount:* *${amount}*` : ""]
            .filter(Boolean)
            .join("\n"),
        },
        accessory: viewButton(OPEN_IN_HUBSPOT, `${PORTAL_BASE}/deal/${id}`),
      },
      {
        type: CONTEXT,
        elements: [
          {
            type: "mrkdwn",
            text: `<!date^${ts()}^{date_short_pretty} at {time}|now>`,
          },
          { type: "mrkdwn", text: "HubSpot · deal.propertyChange (closedwon)" },
        ],
      },
    ],
    icon_emoji: ":trophy:",
    username: CRM_BOT_NAME,
  });
}

async function onTicketCreated(token: string, id: number): Promise<void> {
  const p = await fetchObject(token, "tickets", id, [
    "subject",
    "hs_ticket_priority",
  ]);

  const subject = p?.subject ?? "No subject";
  const priority = (p?.hs_ticket_priority ?? "MEDIUM").toUpperCase();
  let priorityEmoji: string;
  if (priority === "HIGH") {
    priorityEmoji = ":red_circle:";
  } else if (priority === "LOW") {
    priorityEmoji = ":large_green_circle:";
  } else {
    priorityEmoji = ":large_yellow_circle:";
  }

  await slack.post({
    text: `New support ticket: ${subject}`,
    blocks: [
      {
        type: "header",
        text: { type: PLAIN_TEXT, text: "New Support Ticket", emoji: true },
      },
      {
        type: SECTION,
        text: {
          type: "mrkdwn",
          text: [
            `*Subject:* ${subject}`,
            `*Priority:* ${priorityEmoji} ${priority}`,
          ].join("\n"),
        },
        accessory: viewButton(OPEN_IN_HUBSPOT, `${PORTAL_BASE}/ticket/${id}`),
      },
      {
        type: CONTEXT,
        elements: [
          {
            type: "mrkdwn",
            text: `<!date^${ts()}^{date_short_pretty} at {time}|now>`,
          },
          { type: "mrkdwn", text: "HubSpot · ticket.creation" },
        ],
      },
    ],
    icon_emoji: ":ticket:",
    username: CRM_BOT_NAME,
  });
}

async function onCompanyCreated(token: string, id: number): Promise<void> {
  const p = await fetchObject(token, "companies", id, [
    "name",
    "domain",
    "city",
    "country",
  ]);

  const name = p?.name ?? "Unknown Company";
  const domain = p?.domain || "—";
  const location = [p?.city, p?.country].filter(Boolean).join(", ") || "—";

  await slack.post({
    text: `New company: ${name}`,
    blocks: [
      {
        type: "header",
        text: { type: PLAIN_TEXT, text: "New Company", emoji: true },
      },
      {
        type: SECTION,
        text: {
          type: "mrkdwn",
          text: [
            `*Company:* ${name}`,
            `*Domain:* ${domain}`,
            `*Location:* ${location}`,
          ].join("\n"),
        },
        accessory: viewButton(
          OPEN_IN_HUBSPOT,
          `${PORTAL_BASE}/company/${id}`,
        ),
      },
      {
        type: CONTEXT,
        elements: [
          {
            type: "mrkdwn",
            text: `<!date^${ts()}^{date_short_pretty} at {time}|now>`,
          },
          { type: "mrkdwn", text: "HubSpot · company.creation" },
        ],
      },
    ],
    icon_emoji: ":office:",
    username: CRM_BOT_NAME,
  });
}

async function dispatch(token: string, event: HubSpotEvent): Promise<void> {
  const { subscriptionType, objectId, propertyName, propertyValue } = event;

  switch (subscriptionType) {
    case "contact.creation":
      await onContactCreated(token, objectId);
      break;
    case "deal.creation":
      await onDealCreated(token, objectId);
      break;
    case "deal.propertyChange":
      if (propertyName === "dealstage" && propertyValue === "closedwon") {
        await onDealClosedWon(token, objectId);
      }
      break;
    case "ticket.creation":
      await onTicketCreated(token, objectId);
      break;
    case "company.creation":
      await onCompanyCreated(token, objectId);
      break;
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

  const token = cfg.HUBSPOT_API_KEY;

  // Dispatch all events in parallel — fire-and-forget so HubSpot always gets 200
  if (token) {
    Promise.allSettled(events.map((e) => dispatch(token, e))).catch(() => {});
  }

  return NextResponse.json({ received: events.length });
}

// HubSpot sends a GET to verify the webhook URL during setup
export async function GET() {
  return NextResponse.json({ ok: true });
}
