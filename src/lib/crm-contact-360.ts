/**
 * Join EspoCRM + Stripe + D1 for a single admin contact view.
 * Matching is email-only — no new identity graph.
 * Server-only: do not import this module from client components.
 */

import type Stripe from "stripe";
import { getAuthDbFromEnv, getUserByEmail, type AuthDatabase } from "@/lib/auth-d1";
import {
  getContact,
  listContactCases,
  listContactNotes,
  listContactOpportunities,
} from "@/lib/espocrm";
import { getStripe } from "@/lib/stripe";
import {
  emptyAttribution,
  isEspoRecordId,
  matchGoldAttributionRows,
  normalizeEspoContact,
  summarizeNote,
  summarizeRelated,
  type Contact360,
  type Contact360Account,
  type Contact360Attribution,
  type Contact360AttributionTouch,
  type Contact360Event,
  type Contact360Purchase,
  type Contact360Stripe,
  type Contact360Subscription,
} from "@/lib/crm-contact-360-shared";
import { getGoldSection } from "@/lib/datalake-serve";

export type { Contact360 } from "@/lib/crm-contact-360-shared";
export { isEspoRecordId } from "@/lib/crm-contact-360-shared";

const EVENT_LIMIT = 40;

export async function getContact360(id: string): Promise<Contact360 | null> {
  if (!isEspoRecordId(id)) return null;
  const raw = await getContact(id);
  if (!raw || !String(raw.id ?? "").trim()) return null;

  const contact = normalizeEspoContact(raw);
  const email = contact.email;

  const [opportunities, cases, notes, stripe, accountBundle, goldAttribution] = await Promise.all([
    listContactOpportunities(id).then((rows) => rows.map(summarizeRelated)),
    listContactCases(id).then((rows) => rows.map(summarizeRelated)),
    listContactNotes(id).then((rows) => rows.map(summarizeNote)),
    loadStripeForEmail(email),
    loadAccountAndEvents(email),
    loadGoldAttributionSection(),
  ]);

  return {
    contact,
    opportunities,
    cases,
    notes,
    stripe,
    account: accountBundle.account,
    events: accountBundle.events,
    attribution: buildAttribution(accountBundle.touches, goldAttribution),
    fetchedAt: new Date().toISOString(),
  };
}

async function loadAccountAndEvents(email: string): Promise<{
  account: Contact360Account | null;
  events: Contact360Event[];
  touches: Contact360AttributionTouch[];
}> {
  if (!email) return { account: null, events: [], touches: [] };
  const db = getAuthDbFromEnv();
  if (!db) return { account: null, events: [], touches: [] };

  const user = await getUserByEmail(db, email).catch(() => null);
  const account = user
    ? {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        company: user.company ?? null,
        createdAt: user.created_at ? new Date(user.created_at * 1000).toISOString() : null,
      }
    : null;

  const { events, touches } = await listEventsForEmail(db, email, user?.id ?? null).catch(() => ({
    events: [] as Contact360Event[],
    touches: [] as Contact360AttributionTouch[],
  }));
  return { account, events, touches };
}

async function listEventsForEmail(
  db: AuthDatabase,
  email: string,
  userId: string | null
): Promise<{ events: Contact360Event[]; touches: Contact360AttributionTouch[] }> {
  type EventRow = {
    id: string;
    event: string;
    page: string | null;
    source: string | null;
    medium: string | null;
    campaign: string | null;
    properties_json: string | null;
    created_at: number;
  };

  const result = await db
    .prepare(
      `SELECT id, event, page, source, medium, campaign, properties_json, created_at
       FROM analytics_events
       WHERE (? IS NOT NULL AND user_id = ?)
          OR lower(json_extract(properties_json, '$.email')) = lower(?)
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(userId, userId, email, EVENT_LIMIT)
    .all<EventRow>();

  const rows = result.results ?? [];
  const events = rows.map((r) => ({
    id: String(r.id),
    event: String(r.event ?? ""),
    page: String(r.page ?? ""),
    source: String(r.source ?? ""),
    date: new Date(r.created_at * 1000).toISOString(),
  }));

  const touches: Contact360AttributionTouch[] = [];
  for (const row of [...rows].reverse()) {
    const touch = touchFromEventRow(row);
    if (touch) touches.push(touch);
  }

  return { events, touches };
}

function touchFromEventRow(row: {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  properties_json: string | null;
}): Contact360AttributionTouch | null {
  let source = String(row.source ?? "").trim();
  let medium = String(row.medium ?? "").trim();
  let campaign = String(row.campaign ?? "").trim();
  if (row.properties_json) {
    try {
      const props = JSON.parse(row.properties_json) as Record<string, unknown>;
      if (!source) source = String(props.utm_source ?? props.source ?? "").trim();
      if (!medium) medium = String(props.utm_medium ?? props.medium ?? "").trim();
      if (!campaign) campaign = String(props.utm_campaign ?? props.campaign ?? "").trim();
    } catch {
      // properties_json is best-effort
    }
  }
  if (!source && !medium && !campaign) return null;
  return { source, medium, campaign };
}

async function loadGoldAttributionSection(): Promise<Record<string, unknown>[]> {
  try {
    const section = await getGoldSection("attribution");
    if (!section?.rows?.length) return [];
    return section.rows;
  } catch {
    return [];
  }
}

function buildAttribution(
  touches: Contact360AttributionTouch[],
  goldRows: Record<string, unknown>[]
): Contact360Attribution {
  if (touches.length === 0) return emptyAttribution();
  return {
    firstTouch: touches[0] ?? null,
    goldMatches: matchGoldAttributionRows(goldRows, touches),
  };
}

async function loadStripeForEmail(email: string): Promise<Contact360Stripe> {
  const empty: Contact360Stripe = {
    configured: false,
    customer: null,
    purchases: [],
    subscriptions: [],
  };
  if (!email) return empty;

  try {
    const stripe = await getStripe();
    if (!stripe) return empty;

    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];
    if (!customer) {
      return { configured: true, customer: null, purchases: [], subscriptions: [] };
    }

    const [sessions, subscriptions] = await Promise.all([
      stripe.checkout.sessions.list({
        customer: customer.id,
        limit: 20,
      }),
      stripe.subscriptions.list({
        customer: customer.id,
        limit: 20,
        status: "all",
      }),
    ]);

    return {
      configured: true,
      customer: {
        id: customer.id,
        email: customer.email,
        created: new Date(customer.created * 1000).toISOString(),
      },
      purchases: sessions.data.map(mapCheckoutSession),
      subscriptions: subscriptions.data.map(mapSubscription),
    };
  } catch (err) {
    console.warn(
      "[crm-contact-360] Stripe lookup failed:",
      err instanceof Error ? err.message : err
    );
    return { configured: true, customer: null, purchases: [], subscriptions: [] };
  }
}

function mapCheckoutSession(s: Stripe.Checkout.Session): Contact360Purchase {
  return {
    id: s.id,
    status: s.payment_status,
    amount: (s.amount_total ?? 0) / 100,
    currency: (s.currency ?? "eur").toUpperCase(),
    date: new Date(s.created * 1000).toISOString(),
  };
}

function mapSubscription(sub: Stripe.Subscription): Contact360Subscription {
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  return {
    id: sub.id,
    status: sub.status,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  };
}
