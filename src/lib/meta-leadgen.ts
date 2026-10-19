/**
 * Meta (Facebook/Instagram) Lead Ads → EspoCRM helpers.
 *
 * Webhook surface: `object=page` + `field=leadgen`. Meta delivers only
 * metadata (leadgen_id/form_id/page_id) — the lead's answers are fetched
 * with a Page access token via `GET /{leadgen_id}` (requires
 * `leads_retrieval`). Signature check: `X-Hub-Signature-256` =
 * `sha256=<HMAC-SHA256(raw body, META_APP_SECRET)>`.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/guides/lead-ads
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { META_GRAPH_API_BASE } from "@/lib/meta-graph";
import type { LeadData } from "@/lib/espocrm";

export type MetaLeadgenChange = {
  leadgen_id: string;
  page_id?: string;
  form_id?: string;
  ad_id?: string;
  adgroup_id?: string;
  campaign_id?: string;
  created_time?: number;
};

export type MetaLeadgenWebhook = {
  object?: string;
  entry?: {
    id?: string;
    time?: number;
    changes?: { field?: string; value?: MetaLeadgenChange }[];
  }[];
};

export type MetaLeadgenLead = {
  id: string;
  created_time?: string;
  form_id?: string;
  ad_id?: string;
  ad_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  platform?: string;
  is_organic?: boolean;
  field_data?: { name?: string; values?: string[] }[];
};

function safeEqHex(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

/** Verify `X-Hub-Signature-256: sha256=<hex>` over the raw request body. */
export function verifyHubSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return safeEqHex(provided, expected);
}

/** Extract leadgen changes from the webhook envelope. */
export function extractLeadgenChanges(payload: unknown): MetaLeadgenChange[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as MetaLeadgenWebhook;
  if (body.object !== "page" || !Array.isArray(body.entry)) return [];
  const out: MetaLeadgenChange[] = [];
  for (const entry of body.entry) {
    for (const change of entry?.changes ?? []) {
      if (
        change?.field === "leadgen" &&
        change.value?.leadgen_id &&
        LEADGEN_ID_RE.test(change.value.leadgen_id)
      ) {
        out.push(change.value);
      }
    }
  }
  return out;
}

/** Meta object ids are numeric — reject anything else before it reaches a URL. */
const LEADGEN_ID_RE = /^\d{1,32}$/;

/** Fetch one lead's answers via the Graph API (Page access token). */
export async function fetchLeadgenLead(
  leadgenId: string,
  pageAccessToken: string
): Promise<MetaLeadgenLead | null> {
  if (!LEADGEN_ID_RE.test(leadgenId)) return null;
  const url = new URL(`${META_GRAPH_API_BASE}/${leadgenId}`);
  url.searchParams.set(
    "fields",
    "id,created_time,form_id,ad_id,ad_name,adgroup_id,campaign_id,campaign_name,platform,is_organic,field_data"
  );
  url.searchParams.set("access_token", pageAccessToken);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.error("[meta-leadgen] Graph fetch failed:", res.status);
      return null;
    }
    return (await res.json()) as MetaLeadgenLead;
  } catch (err) {
    console.error(
      "[meta-leadgen] Graph fetch error:",
      err instanceof Error ? err.name : "UnknownError"
    );
    return null;
  }
}

type FieldDatum = { name?: string; values?: string[] };

function fieldDataOrEmpty(d: MetaLeadgenLead["field_data"]): FieldDatum[] {
  return Array.isArray(d) ? d : [];
}

function first(fd: FieldDatum[], ...names: string[]): string | undefined {
  for (const name of names) {
    const hit = fd.find((f) => f.name?.toLowerCase() === name);
    const v = hit?.values?.[0]?.trim();
    if (v) return v;
  }
  return undefined;
}

function splitFullName(full: string | undefined): { firstName?: string; lastName?: string } {
  const parts = (full ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const [first, ...rest] = parts;
  return {
    firstName: first || undefined,
    lastName: rest.length ? rest.join(" ") : undefined,
  };
}

/** Map a Graph API lead object to EspoCRM LeadData. */
export function toEspoLeadDataFromMeta(
  lead: MetaLeadgenLead,
  change: MetaLeadgenChange
): LeadData | null {
  const fd = fieldDataOrEmpty(lead.field_data);
  const emailRaw = first(fd, "email", "email_address");
  const email = emailRaw?.toLowerCase();
  if (!email) return null;

  const explicitFirst = first(fd, "first_name");
  const explicitLast = first(fd, "last_name");
  const full = first(fd, "full_name", "name");
  const split = explicitFirst
    ? { firstName: explicitFirst, lastName: explicitLast }
    : splitFullName(full);

  const phone = first(fd, "phone_number", "phone");
  const known = new Set([
    "email",
    "email_address",
    "first_name",
    "last_name",
    "full_name",
    "name",
    "phone_number",
    "phone",
  ]);
  const extras = fd
    .filter((f) => f.name && !known.has(f.name.toLowerCase()) && f.values?.[0])
    .map((f) => `${f.name}: ${f.values?.[0]}`);

  const platform = lead.platform === "ig" ? "instagram" : "facebook";
  const campaignRef =
    lead.campaign_name ?? lead.campaign_id ?? change.campaign_id ?? "meta-lead-ads";
  const isPaid = !lead.is_organic;

  const descLines = [
    `Source: Meta Lead Ad (${platform})`,
    (lead.form_id ?? change.form_id) ? `Form: ${lead.form_id ?? change.form_id}` : null,
    (lead.ad_name ?? lead.ad_id ?? change.ad_id)
      ? `Ad: ${lead.ad_name ?? lead.ad_id ?? change.ad_id}`
      : null,
    (lead.campaign_name ?? lead.campaign_id ?? change.campaign_id)
      ? `Campaign: ${lead.campaign_name ?? lead.campaign_id ?? change.campaign_id}`
      : null,
    lead.is_organic ? "Organic lead (no ad spend)" : null,
    ...extras,
  ].filter((v): v is string => Boolean(v));

  return {
    emailAddress: email,
    firstName: split.firstName,
    lastName: split.lastName,
    phoneNumber: phone,
    source: "Meta Lead Ad",
    campaignSlug: `meta-lead-${change.form_id ?? lead.form_id ?? "form"}`,
    orderId: `meta-leadgen-${lead.id}`,
    description: descLines.join("\n"),
    utmSource: platform,
    utmMedium: isPaid ? "paid" : "social",
    utmCampaign: String(campaignRef),
    utmContent: lead.ad_id ?? change.ad_id,
    targetListNames: ["Meta lead ads"],
  };
}
