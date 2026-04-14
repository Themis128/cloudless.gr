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

/**
 * Resolve HubSpot token: try process.env first, fall back to SSM.
 * In Lambda, env vars aren't set for HUBSPOT_API_KEY — SSM is the source of truth.
 */
async function getHubSpotToken(): Promise<string> {
  const envToken = getIntegrations().HUBSPOT_API_KEY;
  if (envToken) return envToken;

  const config = await getConfig();
  const ssmToken = config.HUBSPOT_API_KEY;
  if (ssmToken) return ssmToken;

  throw new Error("HubSpot not configured (no token in env or SSM)");
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
  let token: string;
  try {
    token = await getHubSpotToken();
  } catch {
    return null;
  }
  // token is resolved — proceed (hubspotFetch will also resolve it, but it's cached in SSM)
  void token;

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
  try {
    const res = await hubspotFetch(
      `/crm/v3/objects/contacts?limit=${limit}&properties=email,firstname,lastname,company,createdate,hs_lead_status`,
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
  let token: string;
  try {
    token = await getHubSpotToken();
  } catch {
    return null;
  }
  void token;

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

/* ─── CRM list helpers (admin dashboard) ─────────────────────────────────── */

/**
 * List available pipelines for a given CRM object type.
 *
 * @param objectType - HubSpot object type (default: "deals")
 * @returns Array of pipeline objects, or [] on error.
 */
export async function getPipelines(objectType = "deals"): Promise<unknown[]> {
  try {
    const res = await hubspotFetch(`/crm/v3/pipelines/${objectType}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}

/**
 * List CRM companies.
 *
 * @param limit - Max records to return (1–100, default 20).
 * @returns Array of company objects, or [] on error.
 */
export async function listCompanies(limit = 20): Promise<unknown[]> {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.trunc(limit), 1), 100)
    : 20;
  try {
    const res = await hubspotFetch(
      `/crm/v3/objects/companies?limit=${safeLimit}&properties=name,domain,city,country,createdate`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}

/**
 * List CRM deals.
 *
 * @param limit - Max records to return (1–100, default 20).
 * @returns Array of deal objects, or [] on error.
 */
export async function listDeals(limit = 20): Promise<unknown[]> {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.trunc(limit), 1), 100)
    : 20;
  try {
    const res = await hubspotFetch(
      `/crm/v3/objects/deals?limit=${safeLimit}&properties=dealname,amount,dealstage,closedate,createdate`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}

/**
 * List CRM owners (HubSpot users).
 *
 * @returns Array of owner objects, or [] on error.
 */
export async function listOwners(): Promise<unknown[]> {
  try {
    const res = await hubspotFetch("/crm/v3/owners");
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
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
