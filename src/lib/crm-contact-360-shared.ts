/**
 * Pure CRM contact helpers + types. Safe to import from client components.
 * I/O lives in crm-contact-360.ts (server only).
 */

export function isEspoRecordId(id: string): boolean {
  return /^[a-zA-Z0-9]{8,24}$/.test(id);
}

export interface Contact360Person {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  company: string;
  accountId: string | null;
  leadSource: string;
  description: string;
  createdAt: string;
  modifiedAt: string;
}

export interface Contact360Related {
  id: string;
  name: string;
  status: string;
  amount: number | null;
  createdAt: string;
}

export interface Contact360Note {
  id: string;
  post: string;
  createdAt: string;
}

export interface Contact360Purchase {
  id: string;
  status: string;
  amount: number;
  currency: string;
  date: string;
}

export interface Contact360Subscription {
  id: string;
  status: string;
  currentPeriodEnd: string | null;
}

export interface Contact360Stripe {
  configured: boolean;
  customer: { id: string; email: string | null; created: string } | null;
  purchases: Contact360Purchase[];
  subscriptions: Contact360Subscription[];
}

export interface Contact360Account {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  createdAt: string | null;
}

export interface Contact360Event {
  id: string;
  event: string;
  page: string;
  source: string;
  date: string;
}

export interface Contact360AttributionTouch {
  source: string;
  medium: string;
  campaign: string;
}

export interface Contact360GoldAttributionRow {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  sessions: number;
  signups: number;
  purchases: number;
  revenue: number;
}

export interface Contact360Attribution {
  firstTouch: Contact360AttributionTouch | null;
  goldMatches: Contact360GoldAttributionRow[];
}

export interface Contact360Scores {
  rfmScore: number | null;
  recencyDays: number | null;
  frequency: number | null;
  monetary: number | null;
  lastPurchaseAt: string | null;
  churnScore: number | null;
  riskBand: string | null;
}

export interface Contact360 {
  contact: Contact360Person;
  opportunities: Contact360Related[];
  cases: Contact360Related[];
  notes: Contact360Note[];
  stripe: Contact360Stripe;
  account: Contact360Account | null;
  events: Contact360Event[];
  attribution: Contact360Attribution;
  scores: Contact360Scores;
  fetchedAt: string;
}

export function emptyAttribution(): Contact360Attribution {
  return { firstTouch: null, goldMatches: [] };
}

export function emptyScores(): Contact360Scores {
  return {
    rfmScore: null,
    recencyDays: null,
    frequency: null,
    monetary: null,
    lastPurchaseAt: null,
    churnScore: null,
    riskBand: null,
  };
}

function normSource(value: string): string {
  return value.trim() || "(direct)";
}

function normMedium(value: string): string {
  return value.trim() || "(none)";
}

function normCampaign(value: string): string {
  return value.trim() || "(none)";
}

export function matchGoldAttributionRows(
  goldRows: Record<string, unknown>[],
  touches: Contact360AttributionTouch[]
): Contact360GoldAttributionRow[] {
  if (goldRows.length === 0 || touches.length === 0) return [];
  const keys = new Set(
    touches.map(
      (t) => `${normSource(t.source)}|${normMedium(t.medium)}|${normCampaign(t.campaign)}`
    )
  );
  const out: Contact360GoldAttributionRow[] = [];
  for (const raw of goldRows) {
    const utmSource = normSource(asString(raw.utm_source ?? raw.utmSource));
    const utmMedium = normMedium(asString(raw.utm_medium ?? raw.utmMedium));
    const utmCampaign = normCampaign(asString(raw.utm_campaign ?? raw.utmCampaign));
    if (!keys.has(`${utmSource}|${utmMedium}|${utmCampaign}`)) continue;
    out.push({
      utmSource,
      utmMedium,
      utmCampaign,
      sessions: asNumber(raw.sessions),
      signups: asNumber(raw.signups),
      purchases: asNumber(raw.purchases),
      revenue: asNumber(raw.revenue),
    });
  }
  return out;
}

export function matchRfmChurnRow(
  goldRows: Record<string, unknown>[],
  email: string
): Contact360Scores {
  const needle = email.trim().toLowerCase();
  if (!needle || goldRows.length === 0) return emptyScores();
  const row = goldRows.find((raw) => asString(raw.email).toLowerCase() === needle);
  if (!row) return emptyScores();
  const lastPurchaseAt = asString(row.last_purchase_at ?? row.lastPurchaseAt);
  const riskBand = asString(row.risk_band ?? row.riskBand);
  return {
    rfmScore: asNumberOrNull(row.rfm_score ?? row.rfmScore),
    recencyDays: asNumberOrNull(row.recency_days ?? row.recencyDays),
    frequency: asNumberOrNull(row.frequency),
    monetary: asNumberOrNull(row.monetary),
    lastPurchaseAt: lastPurchaseAt || null,
    churnScore: asNumberOrNull(row.churn_score ?? row.churnScore ?? row.churn_risk),
    riskBand: riskBand || null,
  };
}

export function contactDisplayName(c: {
  firstName?: string;
  lastName?: string;
  email?: string;
}): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return name || c.email || "—";
}

export function normalizeEspoContact(raw: Record<string, unknown>): Contact360Person {
  return {
    id: asString(raw.id),
    email: asString(raw.emailAddress),
    firstName: asString(raw.firstName),
    lastName: asString(raw.lastName),
    phone: asString(raw.phoneNumber),
    company: asString(raw.accountName),
    accountId: raw.accountId ? asString(raw.accountId) : null,
    leadSource: asString(raw.leadSource ?? raw.source),
    description: asString(raw.description),
    createdAt: asString(raw.createdAt),
    modifiedAt: asString(raw.modifiedAt),
  };
}

export function summarizeRelated(raw: unknown): Contact360Related {
  const row = asRecord(raw);
  const amountRaw = row.amount;
  const amount = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);
  return {
    id: asString(row.id),
    name: asString(row.name),
    status: asString(row.stage ?? row.status),
    amount: Number.isFinite(amount) ? amount : null,
    createdAt: asString(row.createdAt),
  };
}

export function summarizeNote(raw: unknown): Contact360Note {
  const row = asRecord(raw);
  return {
    id: asString(row.id),
    post: asString(row.post ?? row.data),
    createdAt: asString(row.createdAt),
  };
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}
