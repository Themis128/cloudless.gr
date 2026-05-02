import { getIntegrationsAsync } from "@/lib/integrations";

const HUBSPOT_API = "https://api.hubapi.com";
const HUBSPOT_PAGE_SIZE = 100;
const HUBSPOT_MAX_LIMIT = 100;
const HUBSPOT_BATCH_NOTE_LIMIT = 100;
const HUBSPOT_DEFINED = "HUBSPOT_DEFINED";

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
 * Resolve HubSpot token via getIntegrationsAsync() which falls back to SSM.
 * In Lambda, env vars aren't set for HUBSPOT_API_KEY — SSM is the source of truth.
 */
async function getHubSpotToken(): Promise<string> {
  const cfg = await getIntegrationsAsync();
  const token = cfg.HUBSPOT_API_KEY;
  if (token) return token;

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
 * Fetch all pages of a HubSpot list endpoint using cursor-based pagination.
 * Stops when `paging.next.after` is absent in the response.
 */
async function hubspotListAll<T = unknown>(path: string): Promise<T[]> {
  const results: T[] = [];
  let after: string | undefined;

  do {
    const sep = path.includes("?") ? "&" : "?";
    const afterParam = after ? "&after=" + encodeURIComponent(after) : "";
    const url = `${path}${sep}limit=${HUBSPOT_PAGE_SIZE}${afterParam}`;
    const res = await hubspotFetch(url);
    if (!res.ok) break;
    const data = (await res.json()) as {
      results: T[];
      paging?: { next?: { after: string } };
    };
    results.push(...data.results);
    after = data.paging?.next?.after;
  } while (after);

  return results;
}

/**
 * Create or update a HubSpot contact.
 * Uses the email as the unique identifier.
 * Silently returns null if no HubSpot token is available.
 */
export async function upsertContact(
  contact: HubSpotContact,
): Promise<string | null> {
  if (!(await isHubSpotConfigured())) return null;

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
    ? Math.min(Math.max(Math.trunc(limit), 1), HUBSPOT_MAX_LIMIT)
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

/**
 * List CRM support tickets.
 *
 * @param limit - Max records to return (1–100, default 20).
 */
export async function listTickets(limit = 20): Promise<unknown[]> {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.trunc(limit), 1), HUBSPOT_MAX_LIMIT)
    : 20;
  try {
    const res = await hubspotFetch(
      `/crm/v3/objects/tickets?limit=${safeLimit}&properties=subject,content,hs_pipeline,hs_pipeline_stage,hs_ticket_priority,createdate`,
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
  if (!(await isHubSpotConfigured())) return null;

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
            associationCategory: HUBSPOT_DEFINED,
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
    ? Math.min(Math.max(Math.trunc(limit), 1), HUBSPOT_MAX_LIMIT)
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
    ? Math.min(Math.max(Math.trunc(limit), 1), HUBSPOT_MAX_LIMIT)
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

/**
 * Check whether HubSpot is configured (token available in env or SSM).
 */
export async function isHubSpotConfigured(): Promise<boolean> {
  try {
    await getHubSpotToken();
    return true;
  } catch {
    return false;
  }
}

/* ─── Deal automation ────────────────────────────────────────────────────── */

export type DealSource =
  | "stripe_checkout"
  | "calendar_booking"
  | "contact_form";

interface DealData {
  /** Human-readable deal name, e.g. "Purchase – session_xyz" */
  dealname: string;
  /** Amount in major currency units (e.g. 49.00). Omit for consultations. */
  amount?: number;
  /** ISO-4217 currency code, e.g. "EUR". Defaults to EUR. */
  currency?: string;
  /** Pipeline stage ID. Defaults to "closedwon" for purchases, "appointmentscheduled" for consultations. */
  dealstage?: string;
  /** Pipeline ID. Defaults to "default". */
  pipeline?: string;
  /** Close date as ISO string. Defaults to today. */
  closedate?: string;
  /** Where the deal originated. */
  lead_source?: DealSource;
  /** Extra notes / metadata stored in the deal description. */
  description?: string;
  /** Service the deal is associated with (matches service_interest on contacts). */
  service_interest?: string;
}

/**
 * Create a new deal in HubSpot.
 * Returns the new deal ID, or null if HubSpot is not configured or creation fails.
 * Fire-and-forget safe — never throws.
 */
export async function createDeal(data: DealData): Promise<string | null> {
  if (!(await isHubSpotConfigured())) return null;

  const closedate =
    data.closedate ?? new Date().toISOString().split("T")[0] + "T00:00:00.000Z";

  const properties: Record<string, string> = {
    dealname: data.dealname,
    dealstage:
      data.dealstage ??
      (data.amount !== undefined ? "closedwon" : "appointmentscheduled"),
    pipeline: data.pipeline ?? "default",
    closedate,
    ...(data.amount !== undefined && { amount: String(data.amount) }),
    ...(data.currency && { deal_currency_code: data.currency.toUpperCase() }),
    ...(data.lead_source && { lead_source: data.lead_source }),
    ...(data.description && { description: data.description }),
    ...(data.service_interest && { service_interest: data.service_interest }),
  };

  try {
    const res = await hubspotFetch("/crm/v3/objects/deals", {
      method: "POST",
      body: JSON.stringify({ properties }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[HubSpot] createDeal failed:", res.status, err);
      return null;
    }

    const deal = await res.json();
    return deal.id as string;
  } catch (err) {
    console.error("[HubSpot] createDeal error:", err);
    return null;
  }
}

/**
 * Update a deal's properties.
 */
export async function updateDeal(
  id: string,
  data: Partial<Record<string, string>>,
): Promise<{ id: string } | null> {
  try {
    const res = await hubspotFetch(`/crm/v3/objects/deals/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ properties: data }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Move a deal to a new pipeline stage.
 */
export async function moveDealStage(
  id: string,
  stageId: string,
): Promise<{ id: string } | null> {
  return updateDeal(id, { dealstage: stageId });
}

/**
 * Get all deals grouped by stage for a kanban board view.
 * Returns a map of stageId -> deals[].
 */
export async function getDealsByStage(): Promise<Record<string, unknown[]>> {
  try {
    const allDeals = await hubspotListAll<{
      properties: { dealstage: string };
    }>(
      `/crm/v3/objects/deals?properties=dealname,amount,dealstage,pipeline,closedate,createdate,hs_deal_stage_probability`,
    );
    const grouped: Record<string, unknown[]> = {};
    for (const deal of allDeals) {
      const stage = deal.properties.dealstage;
      if (!grouped[stage]) grouped[stage] = [];
      grouped[stage].push(deal);
    }
    return grouped;
  } catch {
    return {};
  }
}

/**
 * Create a note on a deal.
 */
export async function createNote(
  dealId: string,
  body: string,
): Promise<{ id: string } | null> {
  try {
    const res = await hubspotFetch("/crm/v3/objects/notes", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_note_body: body,
          hs_timestamp: new Date().toISOString(),
        },
        associations: [
          {
            to: { id: dealId },
            types: [
              {
                associationCategory: HUBSPOT_DEFINED,
                associationTypeId: 214,
              },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Create a note on a contact's timeline.
 */
export async function createContactNote(
  contactId: string,
  body: string,
): Promise<{ id: string } | null> {
  try {
    const res = await hubspotFetch("/crm/v3/objects/notes", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_note_body: body,
          hs_timestamp: new Date().toISOString(),
        },
        associations: [
          {
            to: { id: contactId },
            types: [
              {
                associationCategory: HUBSPOT_DEFINED,
                associationTypeId: 202,
              },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * List notes for a deal.
 */
export async function listNotes(dealId: string): Promise<unknown[]> {
  try {
    const res = await hubspotFetch(
      `/crm/v3/objects/deals/${dealId}/associations/notes`,
    );
    if (!res.ok) return [];
    const assocData = await res.json();
    const noteIds: string[] = (assocData.results ?? []).map(
      (r: { id: string }) => r.id,
    );
    if (noteIds.length === 0) return [];

    // Batch read all notes in a single request instead of N individual fetches
    const batchRes = await hubspotFetch("/crm/v3/objects/notes/batch/read", {
      method: "POST",
      body: JSON.stringify({
        properties: ["hs_note_body", "hs_timestamp"],
        inputs: noteIds.slice(0, HUBSPOT_BATCH_NOTE_LIMIT).map((id) => ({ id })),
      }),
    });
    if (!batchRes.ok) return [];
    const batchData = await batchRes.json();
    return batchData.results ?? [];
  } catch {
    return [];
  }
}

/**
 * Pipeline stats: conversion rates and deal counts per stage.
 */
export async function getPipelineStats(): Promise<{
  totalDeals: number;
  totalValue: number;
  byStage: Record<string, { count: number; value: number }>;
}> {
  try {
    const allDeals = await hubspotListAll<{
      properties: { dealstage: string; amount: string };
    }>(`/crm/v3/objects/deals?properties=dealname,amount,dealstage`);

    const byStage: Record<string, { count: number; value: number }> = {};
    let totalValue = 0;
    for (const deal of allDeals) {
      const { dealstage, amount } = deal.properties;
      const val = Number.parseFloat(amount || "0") || 0;
      if (!byStage[dealstage]) byStage[dealstage] = { count: 0, value: 0 };
      byStage[dealstage].count++;
      byStage[dealstage].value += val;
      totalValue += val;
    }
    return { totalDeals: allDeals.length, totalValue, byStage };
  } catch {
    return { totalDeals: 0, totalValue: 0, byStage: {} };
  }
}

/**
 * Associate an existing deal with an existing contact.
 * Safe to call fire-and-forget — never throws.
 */
export async function associateDealWithContact(
  dealId: string,
  contactId: string,
): Promise<void> {
  try {
    await hubspotFetch(
      `/crm/v4/objects/deals/${dealId}/associations/contacts/${contactId}`,
      {
        method: "PUT",
        body: JSON.stringify([
          { associationCategory: HUBSPOT_DEFINED, associationTypeId: 3 },
        ]),
      },
    );
  } catch (err) {
    console.error("[HubSpot] associateDealWithContact error:", err);
  }
}
