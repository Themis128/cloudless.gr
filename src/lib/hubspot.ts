import { getIntegrations } from "@/lib/integrations";

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

async function hubspotFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { HUBSPOT_API_KEY } = getIntegrations();
  if (!HUBSPOT_API_KEY) throw new Error("HubSpot not configured");

  return fetch(`${HUBSPOT_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      ...options.headers,
    },
  });
}

/**
 * Create or update a HubSpot contact.
 * Uses the email as the unique identifier.
 * Silently returns null if HUBSPOT_API_KEY is not set.
 */
export async function upsertContact(contact: HubSpotContact): Promise<string | null> {
  const { HUBSPOT_API_KEY } = getIntegrations();
  if (!HUBSPOT_API_KEY) return null;

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
          ...(contact.service_interest && { service_interest: contact.service_interest }),
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
          filterGroups: [{
            filters: [{ propertyName: "email", operator: "EQ", value: contact.email }],
          }],
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
                ...(contact.service_interest && { service_interest: contact.service_interest }),
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
