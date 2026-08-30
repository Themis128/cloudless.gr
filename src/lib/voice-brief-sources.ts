/**
 * Shared data-source primitives for the voice-brief cron route.
 *
 * Called by the voice-brief agent (`src/lib/agent-voice-brief.ts`) which wraps
 * each one with `withRetry` and formats the result into a tool-response
 * string. Kept as a separate module so the data-shaping logic stays out of
 * the agent loop and can be unit-tested independently.
 */
import { getSeoSnapshot } from "@/lib/gsc";
import { isEspoCRMConfigured, getPipelineStats, listNewsletterSubscribers } from "@/lib/espocrm";
import { getStripe } from "@/lib/stripe";

export interface SeoMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
}

export interface PipelineMetrics {
  totalDeals: number;
  totalValueEuros: number;
}

export interface EmailMetrics {
  totalContacts: number;
}

export interface StripeMetrics {
  orders: number;
  revenueEuros: number;
}

/** Wraps `getSeoSnapshot()` so consumers don't have to remember the null contract. */
export async function fetchSeoMetrics(): Promise<SeoMetrics | null> {
  const snap = await getSeoSnapshot();
  if (!snap) return null;
  return { clicks: snap.clicks, impressions: snap.impressions, ctr: snap.ctr };
}

/** Returns null when EspoCRM isn't configured; throws on transport errors. */
export async function fetchPipelineMetrics(): Promise<PipelineMetrics | null> {
  if (!(await isEspoCRMConfigured())) return null;
  const p = await getPipelineStats();
  return { totalDeals: p.totalDeals, totalValueEuros: p.totalValue / 100 };
}

/** Newsletter subscriber count — null when EspoCRM isn't configured. */
export async function fetchEmailMetrics(): Promise<EmailMetrics | null> {
  if (!(await isEspoCRMConfigured())) return null;
  const subs = await listNewsletterSubscribers();
  return { totalContacts: subs.length };
}

/**
 * Paid-checkout count + revenue for the most recent 50 Stripe sessions.
 * Caller decides what to do with a null (e.g. STRIPE_SECRET_KEY missing →
 * skip the call rather than throw inside).
 */
export async function fetchStripeMetrics(): Promise<StripeMetrics | null> {
  const stripe = await getStripe();
  if (!stripe) return null;
  const sessions = await stripe.checkout.sessions.list({ limit: 50 });
  const paid = sessions.data.filter((s) => s.payment_status === "paid");
  const revenueEuros = paid.reduce((acc, s) => acc + (s.amount_total ?? 0), 0) / 100;
  return { orders: paid.length, revenueEuros };
}
