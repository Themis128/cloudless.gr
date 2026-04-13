import { getIntegrations } from "@/lib/integrations";
import { getConfig } from "@/lib/ssm-config";

const HUBSPOT_API = "https://api.hubapi.com";

interface HubSpotContact {
  email: string;
  firstname?: string;
  lastname?: string;
  company?: string;
  service_interest?: string;
  message?: string;
  lead_source?: string;
}

function getHubSpotTokenFromEnv(): string | null {
  const integrations = getIntegrations();
  return (
    integrations.HUBSPOT_API_KEY ??
    integrations.HUBSPOT_ACCESS_TOKEN ??
    integrations.HUBSPOT_PRIVATE_APP_TOKEN ??
    null
  );
}

async function getHubSpotTokenFromSsm(): Promise<string | null> {
  const config = await getConfig();
  return (
    config.HUBSPOT_API_KEY ??
    config.HUBSPOT_ACCESS_TOKEN ??
    config.HUBSPOT_PRIVATE_APP_TOKEN ??
    null
  );
}

/**
 * Resolve HubSpot token: try process.env first, fall back to SSM.
 * In Lambda, env vars may not be populated for HubSpot credentials.
 */
async function getHubSpotToken(): Promise<string> {
  const envToken = getHubSpotTokenFromEnv();
  if (envToken) return envToken;

  const ssmToken = await getHubSpotTokenFromSsm();
  if (ssmToken) return ssmToken;

  throw new Error("HubSpot not configured (no token in env or SSM)");
}

export async function isHubSpotConfigured(): Promise<boolean> {
  try {
    await getHubSpotToken();
    return true;
  } catch {
    return false;
  }
}

async function hubspotFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getHubSpotToken();

  return fetch(`${HUBSPOT_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

/**
 * Create or update a HubSpot contact.
 * Uses the email as the unique identifier.
 * Silently returns null if no HubSpot token is available.
 */
export async function upsertContact(
  contact: HubSpotContact,
): Promise<string | null> {
  try {
    await getHubSpotToken();
  } catch {
    return null;
  }

  try {
    const createRes = await hubspotFetch("/crm/v3/objects/contacts", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          email: contact.email,
          firstname: contact.firstname ?? "",
          lastname: contact.lastname ?? "",
          company: contact.company ?? "",
          hs_lead_status: "NEW",
          lifecyclestage: "lead",
          ...(contact.service_interest && {
            service_interest: contact.service_interest,
          }),
          ...(contact.message && { message: contact.message }),
          lead_source: contact.lead_source ?? "website_contact_form",
        },
      }),
    });

    if (createRes.ok) {
      const data = await createRes.json();
      return data.id;
    }

    // Contact exists (409) — update instead
    if (createRes.status === 409) {
      const searchRes = await hubspotFetch("/crm/v3/objects/contacts/search", {
        method: "POST",
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                { propertyName: "email", operator: "EQ", value: contact.email },
              ],
            },
          ],
        }),
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const existingId = searchData.results?.[0]?.id;
        if (existingId) {
          await hubspotFetch(`/crm/v3/objects/contacts/${existingId}`, {
            method: "PATCH",
            body: JSON.stringify({
              properties: {
                ...(contact.company && { company: contact.company }),
                ...(contact.service_interest && {
                  service_interest: contact.service_interest,
                }),
                ...(contact.message && { message: contact.message }),
              },
            }),
          });
          return existingId;
        }
      }
    }

    console.error("[HubSpot] Create failed:", createRes.status);
    return null;
  } catch (err) {
    console.error("[HubSpot] Error:", err);
    return null;
  }
}

/** List recent contacts */
export async function listContacts(limit = 10): Promise<unknown[]> {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.trunc(limit), 1), 100)
    : 10;

  try {
    const res = await hubspotFetch(
      `/crm/v3/objects/contacts?limit=${safeLimit}&properties=email,firstname,lastname,company,createdate,hs_lead_status`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}

/* ─── Ticket support (requires 'tickets' scope) ─────────────────── */

interface TicketData {
  subject: string;
  content: string;
  hs_pipeline?: string;
  hs_pipeline_stage?: string;
  hs_ticket_priority?: string;
}

/**
 * Create a HubSpot support ticket.
 * Optionally associate it with an existing contact.
 */
export async function createTicket(
  data: TicketData,
  contactId?: string,
): Promise<{ id: string } | null> {
  try {
    await getHubSpotToken();
  } catch {
    return null;
  }

  const properties: Record<string, string> = {
    subject: data.subject,
    content: data.content,
    hs_pipeline: data.hs_pipeline || "0",
    hs_pipeline_stage: data.hs_pipeline_stage || "1",
    hs_ticket_priority: data.hs_ticket_priority || "MEDIUM",
  };

  const body: Record<string, unknown> = { properties };

  if (contactId) {
    body.associations = [
      {
        to: { id: contactId },
        types: [
          {
            associationCategory: "HUBSPOT_DEFINED",
            associationTypeId: 16,
          },
        ],
      },
    ];
  }

  const res = await hubspotFetch("/crm/v3/objects/tickets", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`HubSpot API error ${res.status}: ${JSON.stringify(err)}`);
  }

  const ticket = await res.json();
  return { id: ticket.id };
}

/**
 * Search contacts by a property (e.g. email).
 */
export async function searchContacts(
  propertyName: string,
  value: string,
): Promise<{
  total: number;
  results: Array<{ id: string; properties: Record<string, string> }>;
}> {
  const res = await hubspotFetch("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [{ propertyName, operator: "EQ", value }],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`HubSpot API error ${res.status}: ${JSON.stringify(err)}`);
  }

  return res.json();
}
