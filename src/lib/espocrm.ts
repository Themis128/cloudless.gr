/**
 * EspoCRM client — drop-in replacement for src/lib/hubspot.ts.
 *
 * Every function exported here mirrors a function in lib/hubspot.ts so callers
 * can flip imports without changing call sites:
 *
 *   - import { upsertContact, createTicket, listDeals } from "@/lib/hubspot";
 *   + import { upsertContact, createTicket, listDeals } from "@/lib/espocrm";
 *
 * EspoCRM module mapping vs HubSpot:
 *   HubSpot           EspoCRM
 *   -------           -------
 *   contact           Contact
 *   company           Account
 *   deal              Opportunity
 *   ticket            Case
 *   note              Note (parent on Contact / Opportunity)
 *   owner             User (type=regular)
 *   pipeline          Opportunity.stage enum (single pipeline in OSS)
 *
 * Auth: `Espo-Authorization: <base64 user:pwd>` or `X-Api-Key: <hex>`.
 * We use API-key auth (the `cloudless-app` API user, role
 * `Cloudless App Full Access`).
 *
 * Config: ESPOCRM_BASE_URL + ESPOCRM_API_KEY, both in SSM under
 * `/cloudless/production/`; getIntegrationsAsync() reads them.
 */
import { getIntegrationsAsync } from "@/lib/integrations";

const PAGE_SIZE = 100;
const MAX_LIMIT = 100;

interface EspoContact {
  email: string;
  firstname?: string;
  lastname?: string;
  company?: string;
  phone?: string;
  service_interest?: string;
  message?: string;
  lead_source?: string;
}

/** Resolve EspoCRM base URL + API key from env or SSM. Throws if unset. */
async function getEspoConfig(): Promise<{ baseUrl: string; apiKey: string }> {
  const cfg = await getIntegrationsAsync();
  const baseUrl = cfg.ESPOCRM_BASE_URL;
  const apiKey = cfg.ESPOCRM_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("EspoCRM not configured (ESPOCRM_BASE_URL/API_KEY missing in env+SSM)");
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}

async function espoFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { baseUrl, apiKey } = await getEspoConfig();
  return fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
      ...init.headers,
    },
  });
}

/**
 * Walk a paginated EspoCRM list endpoint. EspoCRM uses `offset`+`maxSize` not
 * cursor pagination, so we stride by PAGE_SIZE until the page returns fewer
 * than that many results.
 */
async function espoListAll<T = unknown>(
  entity: string,
  baseParams: Record<string, string> = {}
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  do {
    const params = new URLSearchParams({
      offset: String(offset),
      maxSize: String(PAGE_SIZE),
      ...baseParams,
    });
    const res = await espoFetch(`/${entity}?${params.toString()}`);
    if (!res.ok) break;
    const data = (await res.json()) as { list: T[]; total: number };
    all.push(...data.list);
    if (data.list.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  } while (true);
  return all;
}

/**
 * Map a HubSpot-shaped contact onto EspoCRM Contact fields. EspoCRM stores
 * `accountId` not `company` name — we leave company as a free-text custom
 * field (cAccountName) on initial create; an admin can wire it to a real
 * Account record later via Workflow.
 */
function toEspoContactPayload(c: EspoContact): Record<string, unknown> {
  return {
    emailAddress: c.email,
    firstName: c.firstname ?? "",
    lastName: c.lastname ?? c.email.split("@")[0],
    accountName: c.company ?? undefined,
    phoneNumber: c.phone ?? undefined,
    description: [c.message, c.service_interest && `Service: ${c.service_interest}`]
      .filter(Boolean)
      .join("\n\n"),
    leadSource: mapLeadSource(c.lead_source),
  };
}

function mapLeadSource(s?: string): string | undefined {
  if (!s) return undefined;
  switch (s) {
    case "website_contact_form":
    case "contact_form":
      return "Web Site";
    case "newsletter_signup":
      return "Email";
    case "newsletter_unsubscribed":
      return "Email";
    default:
      return s; // EspoCRM treats unknown values as Other
  }
}

/** Create or update a contact (uniqueness by email). */
export async function upsertContact(contact: EspoContact): Promise<string | null> {
  try {
    // EspoCRM has no upsert primitive — search first, then POST or PATCH.
    const search = await espoFetch(
      `/Contact?` +
        new URLSearchParams({
          "where[0][type]": "equals",
          "where[0][attribute]": "emailAddress",
          "where[0][value]": contact.email,
          maxSize: "1",
        }).toString()
    );
    if (search.ok) {
      const data = (await search.json()) as { list: { id: string }[]; total: number };
      const existing = data.list[0];
      if (existing) {
        await espoFetch(`/Contact/${existing.id}`, {
          method: "PUT",
          body: JSON.stringify(toEspoContactPayload(contact)),
        });
        return existing.id;
      }
    }
    const create = await espoFetch("/Contact", {
      method: "POST",
      body: JSON.stringify(toEspoContactPayload(contact)),
    });
    if (!create.ok) {
      console.error("[EspoCRM] upsertContact create failed:", create.status);
      return null;
    }
    const created = (await create.json()) as { id: string };
    return created.id;
  } catch (err) {
    console.error("[EspoCRM] upsertContact error:", err);
    return null;
  }
}

/** Fetch every newsletter subscriber email. We treat leadSource=Email as
 *  the subscribed state. Mirrors the HubSpot newsletter_signup convention. */
export async function listNewsletterSubscribers(): Promise<string[]> {
  try {
    const all = await espoListAll<{ emailAddress?: string }>("Contact", {
      "where[0][type]": "equals",
      "where[0][attribute]": "leadSource",
      "where[0][value]": "Email",
      select: "emailAddress",
    });
    return [...new Set(all.map((c) => c.emailAddress).filter((e): e is string => Boolean(e)))];
  } catch (err) {
    console.error("[EspoCRM] listNewsletterSubscribers error:", err);
    return [];
  }
}

/** Flip a contact's newsletter state. Maps to leadSource = Email / Other. */
export async function setNewsletterStatus(
  email: string,
  status: "newsletter_signup" | "newsletter_unsubscribed"
): Promise<boolean> {
  try {
    const search = await espoFetch(
      `/Contact?` +
        new URLSearchParams({
          "where[0][type]": "equals",
          "where[0][attribute]": "emailAddress",
          "where[0][value]": email,
          maxSize: "1",
        }).toString()
    );
    if (search.ok) {
      const data = (await search.json()) as { list: { id: string }[] };
      const existing = data.list[0];
      if (existing) {
        const upd = await espoFetch(`/Contact/${existing.id}`, {
          method: "PUT",
          body: JSON.stringify({
            leadSource: status === "newsletter_signup" ? "Email" : "Other",
          }),
        });
        return upd.ok;
      }
    }
    if (status === "newsletter_unsubscribed") return true; // unknown email + unsub = no-op
    const create = await espoFetch("/Contact", {
      method: "POST",
      body: JSON.stringify({
        emailAddress: email,
        lastName: email.split("@")[0],
        leadSource: "Email",
      }),
    });
    return create.ok;
  } catch {
    return false;
  }
}

function clampLimit(limit: number, fallback = 20): number {
  return Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT) : fallback;
}

export async function listContacts(limit = 10): Promise<unknown[]> {
  try {
    const res = await espoFetch(`/Contact?maxSize=${clampLimit(limit, 10)}`);
    if (!res.ok) return [];
    return (((await res.json()) as { list: unknown[] }).list ?? []) as unknown[];
  } catch {
    return [];
  }
}

export async function listTickets(limit = 20): Promise<unknown[]> {
  try {
    const res = await espoFetch(`/Case?maxSize=${clampLimit(limit)}`);
    if (!res.ok) return [];
    return (((await res.json()) as { list: unknown[] }).list ?? []) as unknown[];
  } catch {
    return [];
  }
}

interface TicketData {
  subject: string;
  content: string;
  hs_pipeline?: string;
  hs_pipeline_stage?: string;
  hs_ticket_priority?: string;
}

/**
 * Create a Case. Maps HubSpot ticket-priority strings (LOW/MEDIUM/HIGH/URGENT)
 * to EspoCRM Case.priority (Low/Normal/High/Urgent).
 */
export async function createTicket(
  data: TicketData,
  contactId?: string
): Promise<{ id: string } | null> {
  const priorityMap: Record<string, string> = {
    LOW: "Low",
    MEDIUM: "Normal",
    HIGH: "High",
    URGENT: "Urgent",
  };
  const body: Record<string, unknown> = {
    name: data.subject,
    description: data.content,
    status: data.hs_pipeline_stage || "New",
    priority: priorityMap[data.hs_ticket_priority ?? "MEDIUM"] ?? "Normal",
    contactId: contactId ?? undefined,
  };
  const res = await espoFetch("/Case", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`EspoCRM Case create failed ${res.status}: ${err.slice(0, 200)}`);
  }
  const created = (await res.json()) as { id: string };
  return { id: created.id };
}

/**
 * Return a single-pipeline shape compatible with HubSpot's getPipelines() so
 * the admin pipeline UI doesn't have to branch on backend. The OSS EspoCRM
 * Opportunity module has one pipeline backed by the `stage` enum.
 */
export async function getPipelines(_objectType = "deals"): Promise<unknown[]> {
  void _objectType;
  return [
    {
      id: "default",
      label: "Sales Pipeline",
      stages: [
        { id: "Prospecting", label: "Prospecting", probability: 10 },
        { id: "Qualification", label: "Qualification", probability: 20 },
        { id: "Proposal", label: "Proposal/Price Quote", probability: 50 },
        { id: "Negotiation", label: "Negotiation/Review", probability: 75 },
        { id: "Closed Won", label: "Closed Won", probability: 100 },
        { id: "Closed Lost", label: "Closed Lost", probability: 0 },
      ],
    },
  ];
}

export async function listCompanies(limit = 20): Promise<unknown[]> {
  try {
    const res = await espoFetch(`/Account?maxSize=${clampLimit(limit)}`);
    if (!res.ok) return [];
    return (((await res.json()) as { list: unknown[] }).list ?? []) as unknown[];
  } catch {
    return [];
  }
}

export async function listDeals(limit = 20): Promise<unknown[]> {
  try {
    const res = await espoFetch(`/Opportunity?maxSize=${clampLimit(limit)}`);
    if (!res.ok) return [];
    return (((await res.json()) as { list: unknown[] }).list ?? []) as unknown[];
  } catch {
    return [];
  }
}

export async function listOwners(): Promise<unknown[]> {
  try {
    const res = await espoFetch(
      `/User?` +
        new URLSearchParams({
          "where[0][type]": "equals",
          "where[0][attribute]": "type",
          "where[0][value]": "regular",
          maxSize: "100",
        }).toString()
    );
    if (!res.ok) return [];
    return (((await res.json()) as { list: unknown[] }).list ?? []) as unknown[];
  } catch {
    return [];
  }
}

/** Search Contacts by an attribute (e.g. emailAddress). Property names map:
 *  HubSpot `email` -> EspoCRM `emailAddress`; firstname/lastname unchanged. */
export async function searchContacts(
  propertyName: string,
  value: string
): Promise<{
  total: number;
  results: Array<{ id: string; properties: Record<string, string> }>;
}> {
  const espoAttr =
    propertyName === "email"
      ? "emailAddress"
      : propertyName === "firstname"
        ? "firstName"
        : propertyName === "lastname"
          ? "lastName"
          : propertyName;
  const res = await espoFetch(
    `/Contact?` +
      new URLSearchParams({
        "where[0][type]": "equals",
        "where[0][attribute]": espoAttr,
        "where[0][value]": value,
        maxSize: "100",
      }).toString()
  );
  if (!res.ok) {
    throw new Error(`EspoCRM search failed ${res.status}`);
  }
  const data = (await res.json()) as {
    list: Array<Record<string, unknown> & { id: string }>;
    total: number;
  };
  return {
    total: data.total,
    results: data.list.map((c) => ({
      id: c.id,
      properties: Object.fromEntries(
        Object.entries(c).map(([k, v]) => [k, v == null ? "" : String(v)])
      ),
    })),
  };
}

export async function isHubSpotConfigured(): Promise<boolean> {
  // Kept name so `lib/hubspot` callers don't break on import-flip. Prefer the
  // new name `isEspoCRMConfigured` in new code.
  return isEspoCRMConfigured();
}

export async function isEspoCRMConfigured(): Promise<boolean> {
  try {
    await getEspoConfig();
    return true;
  } catch {
    return false;
  }
}

/* ─── Lead automation (campaign-driven funnel ingress) ──────────────────── */

export interface LeadData {
  emailAddress: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  /** Campaign slug (e.g., "shop-online") — stored in description for
   *  campaign-attributed Lead aggregation in `countLeadsForCampaign`. */
  campaignSlug?: string;
  /** Tier id selected on the landing page (e.g., "essential"). */
  tier?: string | null;
  /** Stripe checkout session ID, calendar booking id, etc — provides
   *  idempotency when this lead is later associated with an Opportunity. */
  orderId?: string | null;
  /** EspoCRM Lead.source enum value (Web Site / Email / Cold Call / Other / etc). */
  source?: string;
  /** UTM source (e.g., "linkedin") — appended to description for reporting. */
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
}

/**
 * Create an EspoCRM Lead. Lead is the right shape for unqualified inbound —
 * e.g., a LinkedIn ad click that converted on the landing page. Once
 * qualified, the operator converts the Lead to a Contact + Opportunity via
 * the EspoCRM UI (or another lib helper).
 *
 * Fires the `Lead.create` webhook → SlackClient → `#leads` channel
 * automatically (PR #1030).
 *
 * Returns the new Lead id, or null on failure. Never throws — safe to call
 * fire-and-forget from a request handler.
 */
export async function createLead(data: LeadData): Promise<string | null> {
  try {
    const descLines = [
      data.campaignSlug && `Campaign: ${data.campaignSlug}`,
      data.tier && `Tier: ${data.tier}`,
      data.orderId && `Order: ${data.orderId}`,
      data.utmSource && `utm_source: ${data.utmSource}`,
      data.utmMedium && `utm_medium: ${data.utmMedium}`,
      data.utmCampaign && `utm_campaign: ${data.utmCampaign}`,
      data.utmContent && `utm_content: ${data.utmContent}`,
    ].filter(Boolean);
    const payload: Record<string, unknown> = {
      emailAddress: data.emailAddress,
      firstName: data.firstName ?? "",
      lastName: data.lastName ?? data.emailAddress.split("@")[0],
      phoneNumber: data.phoneNumber ?? undefined,
      source: data.source ?? "Web Site",
      status: "New",
      description: descLines.length ? descLines.join("\n") : undefined,
    };
    const res = await espoFetch("/Lead", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("[EspoCRM] createLead failed:", res.status);
      return null;
    }
    const created = (await res.json()) as { id: string };
    return created.id;
  } catch (err) {
    console.error("[EspoCRM] createLead error:", err);
    return null;
  }
}

/**
 * Count Leads attributed to a given cloudless.gr campaign slug. Cheap
 * `like '%Campaign: <slug>%'` scan on Lead.description — fine for our volume
 * (tens to low hundreds of leads per campaign). If counts grow into the
 * thousands, promote campaign to a dedicated `cCampaignSlug` custom field
 * on Lead and index it.
 */
export async function countLeadsForCampaign(campaignSlug: string): Promise<number> {
  try {
    const res = await espoFetch(
      `/Lead?` +
        new URLSearchParams({
          "where[0][type]": "contains",
          "where[0][attribute]": "description",
          "where[0][value]": `Campaign: ${campaignSlug}`,
          maxSize: "1",
          select: "id",
        }).toString()
    );
    if (!res.ok) return 0;
    const data = (await res.json()) as { total: number };
    return data.total ?? 0;
  } catch {
    return 0;
  }
}

/* ─── Opportunity automation (HubSpot "deal" equivalents) ────────────────── */

export type DealSource = "stripe_checkout" | "calendar_booking" | "contact_form";

interface DealData {
  dealname: string;
  amount?: number;
  currency?: string;
  dealstage?: string;
  pipeline?: string;
  closedate?: string;
  lead_source?: DealSource;
  description?: string;
  service_interest?: string;
}

function toEspoOpportunityPayload(data: DealData): Record<string, unknown> {
  return {
    name: data.dealname,
    amount: data.amount ?? undefined,
    amountCurrency: (data.currency ?? "EUR").toUpperCase(),
    stage: data.dealstage ?? (data.amount !== undefined ? "Closed Won" : "Prospecting"),
    closeDate: (data.closedate ?? new Date().toISOString()).slice(0, 10),
    leadSource: mapLeadSource(data.lead_source),
    description: [data.description, data.service_interest && `Service: ${data.service_interest}`]
      .filter(Boolean)
      .join("\n\n"),
  };
}

export async function createDeal(data: DealData): Promise<string | null> {
  try {
    const res = await espoFetch("/Opportunity", {
      method: "POST",
      body: JSON.stringify(toEspoOpportunityPayload(data)),
    });
    if (!res.ok) {
      console.error("[EspoCRM] createDeal failed:", res.status);
      return null;
    }
    const created = (await res.json()) as { id: string };
    return created.id;
  } catch (err) {
    console.error("[EspoCRM] createDeal error:", err);
    return null;
  }
}

export async function updateDeal(
  id: string,
  data: Partial<Record<string, string>>
): Promise<{ id: string } | null> {
  try {
    // HubSpot uses snake_case property names; EspoCRM uses camelCase. Map the
    // common ones; pass anything else through (custom fields use whatever name
    // the operator created them with).
    const mapped: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k === "dealname") mapped.name = v;
      else if (k === "dealstage") mapped.stage = v;
      else if (k === "amount") mapped.amount = v;
      else if (k === "closedate") mapped.closeDate = String(v).slice(0, 10);
      else mapped[k] = v;
    }
    const res = await espoFetch(`/Opportunity/${id}`, {
      method: "PUT",
      body: JSON.stringify(mapped),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { id: string };
    return { id: j.id };
  } catch {
    return null;
  }
}

export async function moveDealStage(id: string, stageId: string): Promise<{ id: string } | null> {
  return updateDeal(id, { dealstage: stageId });
}

export async function getDealsByStage(): Promise<Record<string, unknown[]>> {
  try {
    const all = await espoListAll<{ stage: string }>("Opportunity", {
      select: "name,amount,stage,closeDate,createdAt,probability",
    });
    const grouped: Record<string, unknown[]> = {};
    for (const d of all) {
      const stage = d.stage ?? "Unknown";
      if (!grouped[stage]) grouped[stage] = [];
      grouped[stage].push(d);
    }
    return grouped;
  } catch {
    return {};
  }
}

/* ─── Notes ───────────────────────────────────────────────────────────────── */

/** Create a Note (Stream post) on an Opportunity. */
export async function createNote(dealId: string, body: string): Promise<{ id: string } | null> {
  try {
    const res = await espoFetch("/Note", {
      method: "POST",
      body: JSON.stringify({
        type: "Post",
        post: body,
        parentType: "Opportunity",
        parentId: dealId,
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { id: string };
    return { id: j.id };
  } catch {
    return null;
  }
}

/** Create a Note on a Contact's stream. */
export async function createContactNote(
  contactId: string,
  body: string
): Promise<{ id: string } | null> {
  try {
    const res = await espoFetch("/Note", {
      method: "POST",
      body: JSON.stringify({
        type: "Post",
        post: body,
        parentType: "Contact",
        parentId: contactId,
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { id: string };
    return { id: j.id };
  } catch {
    return null;
  }
}

/** List notes for an Opportunity. */
export async function listNotes(dealId: string): Promise<unknown[]> {
  try {
    const res = await espoFetch(
      `/Opportunity/${dealId}/notes?` +
        new URLSearchParams({ maxSize: "100", select: "post,createdAt,type" }).toString()
    );
    if (!res.ok) return [];
    return (((await res.json()) as { list: unknown[] }).list ?? []) as unknown[];
  } catch {
    return [];
  }
}

/** Pipeline stats: count + total value per stage. */
export async function getPipelineStats(): Promise<{
  totalDeals: number;
  totalValue: number;
  byStage: Record<string, { count: number; value: number }>;
}> {
  try {
    const all = await espoListAll<{ stage: string; amount: number | null }>("Opportunity", {
      select: "stage,amount",
    });
    const byStage: Record<string, { count: number; value: number }> = {};
    let totalValue = 0;
    for (const d of all) {
      const stage = d.stage ?? "Unknown";
      const val = Number(d.amount ?? 0) || 0;
      if (!byStage[stage]) byStage[stage] = { count: 0, value: 0 };
      byStage[stage].count++;
      byStage[stage].value += val;
      totalValue += val;
    }
    return { totalDeals: all.length, totalValue, byStage };
  } catch {
    return { totalDeals: 0, totalValue: 0, byStage: {} };
  }
}

/**
 * Associate an Opportunity with a Contact. EspoCRM uses link-based relations;
 * the `contacts` link on Opportunity is many-to-many, so we POST to the link.
 */
export async function associateDealWithContact(dealId: string, contactId: string): Promise<void> {
  try {
    await espoFetch(`/Opportunity/${dealId}/contacts`, {
      method: "POST",
      body: JSON.stringify({ id: contactId }),
    });
  } catch (err) {
    console.error("[EspoCRM] associateDealWithContact error:", err);
  }
}
