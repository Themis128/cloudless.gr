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

export interface Contact360 {
  contact: Contact360Person;
  opportunities: Contact360Related[];
  cases: Contact360Related[];
  notes: Contact360Note[];
  stripe: Contact360Stripe;
  account: Contact360Account | null;
  events: Contact360Event[];
  fetchedAt: string;
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
  if (value == null) return "";
  return String(value).trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}
