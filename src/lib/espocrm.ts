/**
 * EspoCRM client. Replaced the deleted src/lib/hubspot.ts on 2026-06-20
 * (EspoCRM fully decommissioned). All call-site imports use this module.
 *
 * EspoCRM module mapping vs the historical EspoCRM equivalents:
 *   EspoCRM           EspoCRM
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
import { isEspoRecordId } from "@/lib/crm-contact-360-shared";
import {
  ESPO_CACHE_TTL,
  invalidateEspoContactCaches,
  invalidateEspoListCaches,
  readThrough,
} from "@/lib/espocrm-cache";

const PAGE_SIZE = 100;
const MAX_LIMIT = 100;
const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

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
  const url = `${baseUrl}/api/v1${path}`;
  const headers = {
    "Content-Type": "application/json",
    "X-Api-Key": apiKey,
    ...((init.headers ?? {}) as Record<string, string>),
  };
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((r) => setTimeout(r, 200 * 2 ** (attempt - 1)));
    }
    try {
      const res = await fetch(url, {
        ...init,
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (!RETRYABLE_STATUS.has(res.status)) return res;
      if (attempt === MAX_RETRIES - 1) return res;
      if (res.status === 429) {
        const after = parseInt(res.headers.get("Retry-After") ?? "", 10);
        if (Number.isFinite(after) && after > 0 && after < 60) {
          await new Promise<void>((r) => setTimeout(r, after * 1_000));
        }
      }
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES - 1) throw err;
    }
  }
  throw lastErr ?? new Error("espoFetch exhausted retries");
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
    if (!res.ok)
      throw new Error(`EspoCRM ${entity} list page (offset ${offset}) failed: ${res.status}`);
    const data = (await res.json()) as { list: T[]; total: number };
    all.push(...data.list);
    if (data.list.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  } while (true);
  return all;
}

/**
 * Map a EspoCRM-shaped contact onto EspoCRM Contact fields. EspoCRM stores
 * `accountId` not `company` name — we leave company as a free-text custom
 * field (cAccountName) on initial create; an admin can wire it to a real
 * Account record later via Workflow.
 */
function toEspoContactPayload(c: EspoContact, includePhone = true): Record<string, unknown> {
  // EspoCRM validates phone numbers strictly. Only send if it looks like a
  // real phone number (international or local format with 7+ digits).
  // Test/fake numbers like "+30 555 0000" fail the "valid" validator and
  // cause the entire contact creation to 400.
  const rawPhone = c.phone?.replace(/[\s\-()]/g, "") || "";
  const digitCount = rawPhone.replace(/\D/g, "").length;
  const phone = includePhone && digitCount >= 7 ? rawPhone : undefined;
  return {
    emailAddress: c.email,
    firstName: c.firstname ?? "",
    lastName: c.lastname || c.email.split("@")[0],
    accountName: c.company ?? undefined,
    phoneNumber: phone,
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

/** Create or update a contact (uniqueness by email). Links to a real Account
 *  when contact.company is set (calls upsertCompany internally). */
export async function upsertContact(contact: EspoContact): Promise<string | null> {
  try {
    // Resolve Account id before building payload so the Contact links to a real
    // Account record rather than a free-text accountName string.
    const accountId = contact.company
      ? ((await upsertCompany(contact.company)) ?? undefined)
      : undefined;
    const basePayload = toEspoContactPayload(contact);
    const payload = accountId ? { ...basePayload, accountId, accountName: undefined } : basePayload;
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
          body: JSON.stringify(payload),
        });
        void invalidateEspoContactCaches(existing.id);
        return existing.id;
      }
    }
    let create = await espoFetch("/Contact", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    // Check for 409 conflict FIRST, before any body-consuming logic.
    // A 409 means the contact already exists — no point retrying with/without phone.
    if (create.status === 409) {
      // Contact already exists (race condition or search missed it).
      // The 409 response body contains the full contact record — extract the ID.
      const conflictBody = (await create.json().catch(() => ({}))) as { id?: string };
      if (conflictBody.id) {
        // Update the existing contact with the new data.
        await espoFetch(`/Contact/${conflictBody.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        }).catch(() => {});
        void invalidateEspoContactCaches(conflictBody.id);
        return conflictBody.id;
      }
    }
    if (!create.ok && contact.phone) {
      // Retry without phone — EspoCRM's phone validator is strict and may
      // reject numbers that are technically valid but don't match its
      // expected format. The contact is more important than the phone.
      const errBody = await create.text().catch(() => "");
      if (errBody.includes("phoneNumber")) {
        const retryPayload = toEspoContactPayload(contact, false);
        if (accountId) Object.assign(retryPayload, { accountId, accountName: undefined });
        create = await espoFetch("/Contact", {
          method: "POST",
          body: JSON.stringify(retryPayload),
        });
        // The retry may also hit a 409 (race) — handle it here too.
        if (create.status === 409) {
          const conflictBody = (await create.json().catch(() => ({}))) as { id?: string };
          if (conflictBody.id) {
            await espoFetch(`/Contact/${conflictBody.id}`, {
              method: "PUT",
              body: JSON.stringify(payload),
            }).catch(() => {});
            void invalidateEspoContactCaches(conflictBody.id);
            return conflictBody.id;
          }
        }
      }
    }
    if (!create.ok) {
      const errBody = await create.text().catch(() => "");
      console.error("[EspoCRM] upsertContact create failed:", create.status, errBody.slice(0, 300));
      return null;
    }
    const created = (await create.json()) as { id: string };
    void invalidateEspoContactCaches(created.id);
    return created.id;
  } catch (err) {
    console.error("[EspoCRM] upsertContact error:", err);
    return null;
  }
}

/** Fetch every newsletter subscriber email. We treat leadSource=Email as
 *  the subscribed state. Mirrors the EspoCRM newsletter_signup convention. */
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

export async function listLeads(limit = 20): Promise<unknown[]> {
  const clamped = clampLimit(limit);
  const { value } = await readThrough(
    "espocrm:listLeads",
    { limit: clamped },
    async () => {
      try {
        const res = await espoFetch(
          `/Lead?` +
            new URLSearchParams({
              maxSize: String(clamped),
              orderBy: "createdAt",
              order: "desc",
            }).toString()
        );
        if (!res.ok) return [];
        return (((await res.json()) as { list: unknown[] }).list ?? []) as unknown[];
      } catch {
        return [];
      }
    },
    { ttlSeconds: ESPO_CACHE_TTL.list, acceptStaleSeconds: 300 }
  );
  return value;
}

export async function listContacts(limit = 10): Promise<unknown[]> {
  const clamped = clampLimit(limit, 10);
  const { value } = await readThrough(
    "espocrm:listContacts",
    { limit: clamped },
    async () => {
      try {
        const res = await espoFetch(`/Contact?maxSize=${clamped}`);
        if (!res.ok) return [];
        return (((await res.json()) as { list: unknown[] }).list ?? []) as unknown[];
      } catch {
        return [];
      }
    },
    { ttlSeconds: ESPO_CACHE_TTL.list, acceptStaleSeconds: 300 }
  );
  return value;
}

export async function getContact(id: string): Promise<Record<string, unknown> | null> {
  if (!isEspoRecordId(id)) return null;
  const { value } = await readThrough(
    "espocrm:getContact",
    { id },
    async () => {
      try {
        const res = await espoFetch(`/Contact/${encodeURIComponent(id)}`);
        if (!res.ok) return null;
        return (await res.json()) as Record<string, unknown>;
      } catch {
        return null;
      }
    },
    { ttlSeconds: ESPO_CACHE_TTL.contact, acceptStaleSeconds: 300 }
  );
  return value;
}

async function listContactLink(contactId: string, link: string): Promise<unknown[]> {
  if (!isEspoRecordId(contactId)) return [];
  const pk =
    link === "opportunities"
      ? "espocrm:listContactOpportunities"
      : link === "cases"
        ? "espocrm:listContactCases"
        : "espocrm:listContactNotes";
  const { value } = await readThrough(
    pk,
    { id: contactId },
    async () => {
      try {
        const res = await espoFetch(
          `/Contact/${encodeURIComponent(contactId)}/${link}?maxSize=${MAX_LIMIT}`
        );
        if (!res.ok) return [];
        return (((await res.json()) as { list: unknown[] }).list ?? []) as unknown[];
      } catch {
        return [];
      }
    },
    { ttlSeconds: ESPO_CACHE_TTL.contact, acceptStaleSeconds: 300 }
  );
  return value;
}

export async function listContactOpportunities(contactId: string): Promise<unknown[]> {
  return listContactLink(contactId, "opportunities");
}

export async function listContactCases(contactId: string): Promise<unknown[]> {
  return listContactLink(contactId, "cases");
}

export async function listContactNotes(contactId: string): Promise<unknown[]> {
  return listContactLink(contactId, "notes");
}

export async function listTickets(limit = 20): Promise<unknown[]> {
  const clamped = clampLimit(limit);
  const { value } = await readThrough(
    "espocrm:listTickets",
    { limit: clamped },
    async () => {
      try {
        const res = await espoFetch(`/Case?maxSize=${clamped}`);
        if (!res.ok) return [];
        return (((await res.json()) as { list: unknown[] }).list ?? []) as unknown[];
      } catch {
        return [];
      }
    },
    { ttlSeconds: ESPO_CACHE_TTL.list, acceptStaleSeconds: 300 }
  );
  return value;
}

export interface TicketData {
  name: string;
  description: string;
  status?: string;
  priority?: "Low" | "Normal" | "High" | "Urgent";
}

/** Create an EspoCRM Case (support ticket). */
export async function createTicket(
  data: TicketData,
  contactId?: string
): Promise<{ id: string } | null> {
  const body: Record<string, unknown> = {
    name: data.name,
    description: data.description,
    status: data.status ?? "New",
    priority: data.priority ?? "Normal",
    contactId: contactId ?? undefined,
  };
  const res = await espoFetch("/Case", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`EspoCRM Case create failed ${res.status}: ${err.slice(0, 200)}`);
  }
  const created = (await res.json()) as { id: string };
  void invalidateEspoListCaches();
  if (contactId) void invalidateEspoContactCaches(contactId);
  return { id: created.id };
}

/**
 * Return a single-pipeline shape compatible with EspoCRM's getPipelines() so
 * the admin pipeline UI doesn't have to branch on backend. The OSS EspoCRM
 * Opportunity module has one pipeline backed by the `stage` enum.
 */
export async function getPipelines(_objectType = "deals"): Promise<unknown[]> {
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
  const clamped = clampLimit(limit);
  const { value } = await readThrough(
    "espocrm:listCompanies",
    { limit: clamped },
    async () => {
      try {
        const res = await espoFetch(`/Account?maxSize=${clamped}`);
        if (!res.ok) return [];
        return (((await res.json()) as { list: unknown[] }).list ?? []) as unknown[];
      } catch {
        return [];
      }
    },
    { ttlSeconds: ESPO_CACHE_TTL.list, acceptStaleSeconds: 300 }
  );
  return value;
}

/**
 * Find or create an EspoCRM Account by exact name. Returns the Account id, or
 * null on failure. Called by upsertContact so Contacts link to a real Account
 * record rather than a free-text accountName string.
 */
export async function upsertCompany(name: string): Promise<string | null> {
  try {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const search = await espoFetch(
      `/Account?` +
        new URLSearchParams({
          "where[0][type]": "equals",
          "where[0][attribute]": "name",
          "where[0][value]": trimmed,
          maxSize: "1",
          select: "id",
        }).toString()
    );
    if (search.ok) {
      const data = (await search.json()) as { list: { id: string }[] };
      const existing = data.list[0];
      if (existing) return existing.id;
    }
    const create = await espoFetch("/Account", {
      method: "POST",
      body: JSON.stringify({ name: trimmed }),
    });
    if (!create.ok) return null;
    const created = (await create.json()) as { id: string };
    void invalidateEspoListCaches();
    return created.id;
  } catch (err) {
    console.error("[EspoCRM] upsertCompany error:", err);
    return null;
  }
}

export async function listDeals(limit = 20): Promise<unknown[]> {
  const clamped = clampLimit(limit);
  const { value } = await readThrough(
    "espocrm:listDeals",
    { limit: clamped },
    async () => {
      try {
        const res = await espoFetch(`/Opportunity?maxSize=${clamped}`);
        if (!res.ok) return [];
        return (((await res.json()) as { list: unknown[] }).list ?? []) as unknown[];
      } catch {
        return [];
      }
    },
    { ttlSeconds: ESPO_CACHE_TTL.list, acceptStaleSeconds: 300 }
  );
  return value;
}

export async function listOwners(): Promise<unknown[]> {
  const { value } = await readThrough(
    "espocrm:listOwners",
    {},
    async () => {
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
    },
    { ttlSeconds: ESPO_CACHE_TTL.list, acceptStaleSeconds: 300 }
  );
  return value;
}

/** Search Contacts by an attribute (e.g. emailAddress). Property names map:
 *  EspoCRM `email` -> EspoCRM `emailAddress`; firstname/lastname unchanged. */
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

export async function isEspoCRMConfigured(): Promise<boolean> {
  // Single canonical name (PR #1133 collapsed the legacy `isHubSpotConfigured`
  // alias into this one — both used to coexist, with the alias delegating here).
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
      lastName: data.lastName || data.emailAddress.split("@")[0],
      phoneNumber: data.phoneNumber ?? undefined,
      source: data.source ?? "Web Site",
      status: "New",
      description: descLines.length ? descLines.join("\n") : undefined,
    };
    // Dedup: if a Lead with this email already exists, update it instead of
    // creating a second record. EspoCRM has no unique-email constraint on Lead.
    const dupSearch = await espoFetch(
      `/Lead?` +
        new URLSearchParams({
          "where[0][type]": "equals",
          "where[0][attribute]": "emailAddress",
          "where[0][value]": data.emailAddress,
          maxSize: "1",
          select: "id",
        }).toString()
    );
    if (dupSearch.ok) {
      const dupData = (await dupSearch.json()) as { list: { id: string }[] };
      const existing = dupData.list[0];
      if (existing) {
        await espoFetch(`/Lead/${existing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        return existing.id;
      }
    }
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

/* ─── Opportunity automation (EspoCRM "deal" equivalents) ────────────────── */

export type DealSource = "stripe_checkout" | "calendar_booking" | "contact_form";

export interface DealData {
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

export interface DealUpdateFields {
  dealname?: string;
  dealstage?: string;
  amount?: number | string;
  closedate?: string;
  [key: string]: unknown;
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
    void invalidateEspoListCaches();
    return created.id;
  } catch (err) {
    console.error("[EspoCRM] createDeal error:", err);
    return null;
  }
}

export async function updateDeal(
  id: string,
  data: DealUpdateFields
): Promise<{ id: string } | null> {
  try {
    // EspoCRM uses snake_case property names; EspoCRM uses camelCase. Map the
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
    void invalidateEspoListCaches();
    return { id: j.id };
  } catch {
    return null;
  }
}

export async function moveDealStage(id: string, stageId: string): Promise<{ id: string } | null> {
  const pipelines = (await getPipelines()) as Array<{ stages: { id: string }[] }>;
  const knownStages = pipelines[0]?.stages.map((s) => s.id) ?? [];
  if (!knownStages.includes(stageId)) {
    console.error(
      `[EspoCRM] moveDealStage: unrecognized stageId (${knownStages.length} valid stages exist)`
    );
    return null;
  }
  return updateDeal(id, { dealstage: stageId });
}

export async function getDealsByStage(): Promise<Record<string, unknown[]>> {
  const { value } = await readThrough(
    "espocrm:getDealsByStage",
    {},
    async () => {
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
    },
    { ttlSeconds: ESPO_CACHE_TTL.pipeline, acceptStaleSeconds: 300 }
  );
  return value;
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
    void invalidateEspoListCaches();
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
    void invalidateEspoContactCaches(contactId);
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
  const empty = {
    totalDeals: 0,
    totalValue: 0,
    byStage: {} as Record<string, { count: number; value: number }>,
  };
  const { value } = await readThrough(
    "espocrm:getPipelineStats",
    {},
    async () => {
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
        return empty;
      }
    },
    { ttlSeconds: ESPO_CACHE_TTL.pipeline, acceptStaleSeconds: 300 }
  );
  return value;
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
