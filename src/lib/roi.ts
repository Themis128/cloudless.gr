/**
 * ROI summary — joins ad spend (all campaign platforms), leads (EspoCRM),
 * and revenue (Stripe analytics) into one view (Phase 4 of the roadmap).
 *
 * Every source is optional: unconfigured platforms report configured=false
 * with zero spend instead of failing the whole summary.
 */

import { isGoogleAdsConfigured, getGoogleMetrics } from "@/lib/campaigns/google-ads";
import { isLinkedInConfigured, getLinkedInInsights } from "@/lib/campaigns/linkedin";
import { isTikTokConfigured, getTikTokInsights } from "@/lib/campaigns/tiktok";
import { isXConfigured, getXStats } from "@/lib/campaigns/x-ads";
import { isMetaAdsConfigured, getMetaInsights } from "@/lib/campaigns/meta-ads";
import { listContacts } from "@/lib/espocrm";
import { isConfiguredAsync } from "@/lib/integrations";
import { getStripeAnalyticsSnapshot } from "@/lib/stripe-analytics-read";

export type RoiChannel = "google" | "linkedin" | "tiktok" | "x" | "meta";

export interface ChannelRoi {
  channel: RoiChannel;
  configured: boolean;
  spendCents: number;
  impressions: number;
  clicks: number;
  /** Platform-reported lead conversions, when the platform exposes them. */
  platformLeads: number;
}

export interface RoiSummary {
  windowDays: number;
  generatedAt: string;
  channels: ChannelRoi[];
  totals: {
    spendCents: number;
    impressions: number;
    clicks: number;
    platformLeads: number;
    /** New EspoCRM contacts created inside the window (capped at 100). */
    newLeads: number | null;
    revenueCents: number | null;
    /** Total spend / new leads; null when either side is missing. */
    costPerLeadCents: number | null;
    /** Revenue / spend; null when spend is zero or revenue unknown. */
    roas: number | null;
  };
}

// ── Pure normalizers (unit-tested) ──────────────────────────────────────────

/** Google Ads / X Ads report micros (1e-6 currency units) → cents. */
export function microsToCents(micros: number): number {
  return Math.round((micros || 0) / 10_000);
}

/** String currency amounts ("12.34") → cents. Bad input → 0. */
export function currencyStringToCents(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
}

/** Numeric currency units → cents. */
export function unitsToCents(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
}

export function computeCostPerLeadCents(
  spendCents: number,
  newLeads: number | null
): number | null {
  if (!newLeads || newLeads <= 0 || spendCents <= 0) return null;
  return Math.round(spendCents / newLeads);
}

export function computeRoas(spendCents: number, revenueCents: number | null): number | null {
  if (revenueCents === null || spendCents <= 0) return null;
  return Math.round((revenueCents / spendCents) * 100) / 100;
}

// ── Source collectors ────────────────────────────────────────────────────────

function emptyChannel(channel: RoiChannel): ChannelRoi {
  return { channel, configured: false, spendCents: 0, impressions: 0, clicks: 0, platformLeads: 0 };
}

async function collectGoogle(start: string, end: string): Promise<ChannelRoi> {
  const out = emptyChannel("google");
  if (!(await isGoogleAdsConfigured())) return out;
  out.configured = true;
  const m = await getGoogleMetrics(start, end);
  out.spendCents = microsToCents(m.costMicros);
  out.impressions = m.impressions;
  out.clicks = m.clicks;
  return out;
}

async function collectLinkedIn(start: string, end: string): Promise<ChannelRoi> {
  const out = emptyChannel("linkedin");
  if (!(await isLinkedInConfigured())) return out;
  out.configured = true;
  const i = await getLinkedInInsights(start, end);
  out.spendCents = currencyStringToCents(i.costInLocalCurrency);
  out.impressions = i.impressions;
  out.clicks = i.clicks;
  out.platformLeads = i.conversions;
  return out;
}

async function collectTikTok(start: string, end: string): Promise<ChannelRoi> {
  const out = emptyChannel("tiktok");
  if (!(await isTikTokConfigured())) return out;
  out.configured = true;
  const i = await getTikTokInsights(start, end);
  out.spendCents = currencyStringToCents(i.spend);
  out.impressions = Number.parseInt(i.impressions ?? "0", 10) || 0;
  out.clicks = Number.parseInt(i.clicks ?? "0", 10) || 0;
  return out;
}

async function collectX(start: string, end: string): Promise<ChannelRoi> {
  const out = emptyChannel("x");
  if (!(await isXConfigured())) return out;
  out.configured = true;
  const s = await getXStats(start, end);
  out.spendCents = microsToCents(s.spend_micro);
  out.impressions = s.impressions;
  out.clicks = s.clicks;
  return out;
}

async function collectMeta(start: string, end: string): Promise<ChannelRoi> {
  const out = emptyChannel("meta");
  if (!(await isMetaAdsConfigured())) return out;
  out.configured = true;
  const i = await getMetaInsights(start, end);
  out.spendCents = unitsToCents(i.spend);
  out.impressions = i.impressions;
  out.clicks = i.clicks;
  out.platformLeads = i.leads;
  return out;
}

interface EspoCRMContactRecord {
  properties?: { createdate?: string };
}

/** New EspoCRM contacts created since `sinceIso`. Null when EspoCRM is unconfigured. */
async function countNewLeads(sinceIso: string): Promise<number | null> {
  if (!(await isConfiguredAsync("ESPOCRM_API_KEY"))) return null;
  try {
    const contacts = (await listContacts(100)) as EspoCRMContactRecord[];
    return contacts.filter((c) => {
      const created = c.properties?.createdate;
      return created !== undefined && created >= sinceIso;
    }).length;
  } catch {
    return null;
  }
}

async function collectRevenueCents(days: number): Promise<number | null> {
  try {
    const snapshot = await getStripeAnalyticsSnapshot(days);
    return snapshot.totals.revenueMinor;
  } catch {
    return null;
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

export async function buildRoiSummary(inputDays = 30): Promise<RoiSummary> {
  const days = Math.max(1, Math.min(365, Math.trunc(inputDays) || 30));
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];

  const [google, linkedin, tiktok, x, meta, newLeads, revenueCents] = await Promise.all([
    collectGoogle(startStr, endStr).catch(() => emptyChannel("google")),
    collectLinkedIn(startStr, endStr).catch(() => emptyChannel("linkedin")),
    collectTikTok(startStr, endStr).catch(() => emptyChannel("tiktok")),
    collectX(startStr, endStr).catch(() => emptyChannel("x")),
    collectMeta(startStr, endStr).catch(() => emptyChannel("meta")),
    countNewLeads(start.toISOString()),
    collectRevenueCents(days),
  ]);

  const channels = [google, linkedin, tiktok, x, meta];
  const spendCents = channels.reduce((sum, c) => sum + c.spendCents, 0);

  return {
    windowDays: days,
    generatedAt: new Date().toISOString(),
    channels,
    totals: {
      spendCents,
      impressions: channels.reduce((sum, c) => sum + c.impressions, 0),
      clicks: channels.reduce((sum, c) => sum + c.clicks, 0),
      platformLeads: channels.reduce((sum, c) => sum + c.platformLeads, 0),
      newLeads,
      revenueCents,
      costPerLeadCents: computeCostPerLeadCents(spendCents, newLeads),
      roas: computeRoas(spendCents, revenueCents),
    },
  };
}
