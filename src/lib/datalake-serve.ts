/**
 * Datalake serving facade — gold aggregates + gold insights only.
 * Admin analytics / AI handlers must use this instead of live GSC/Stripe/Espo/ads.
 */

import { getDataLakeBucketFromEnv } from "@/lib/r2-client";
import {
  getDatalakeDashboard,
  loadDatalakeSnapshotFromR2,
  type DatalakeSectionResult,
  type DatalakeDashboardPayload,
} from "@/lib/datalake-r2";
import {
  INSIGHTS_INDEX_KEY,
  insightObjectKey,
  isInsightDomain,
  type DatalakeInsight,
  type DatalakeInsightsIndex,
  type InsightDomain,
} from "@/lib/datalake-insights";

const GSC_WEEKLY_KEY = "lake/snapshots/gsc-weekly.json";

export async function getGoldSection(
  section: string
): Promise<DatalakeSectionResult | null> {
  const dash = await getDatalakeDashboard({});
  return dash.sections.find((s) => s.section === section) ?? null;
}

export async function getFreshness(): Promise<DatalakeDashboardPayload["freshness"]> {
  const dash = await getDatalakeDashboard({});
  return dash.freshness;
}

export async function getGoldDashboard(): Promise<DatalakeDashboardPayload> {
  return getDatalakeDashboard({});
}

async function readJsonFromR2<T>(key: string): Promise<T | null> {
  const bucket = getDataLakeBucketFromEnv();
  if (!bucket) return null;
  const object = await bucket.get(key);
  if (!object) return null;
  try {
    return JSON.parse(await object.text()) as T;
  } catch {
    return null;
  }
}

export async function getInsight(domain: string): Promise<DatalakeInsight | null> {
  const key = insightObjectKey(domain);
  return readJsonFromR2<DatalakeInsight>(key);
}

export async function getInsightsIndex(): Promise<DatalakeInsightsIndex | null> {
  return readJsonFromR2<DatalakeInsightsIndex>(INSIGHTS_INDEX_KEY);
}

export async function listInsightDomains(): Promise<DatalakeInsightsIndex> {
  const index = await getInsightsIndex();
  if (index) return index;
  return { generated_at: new Date().toISOString(), domains: [] };
}

export function assertInsightDomain(domain: string): InsightDomain | null {
  return isInsightDomain(domain) ? domain : null;
}

/** GSC weekly gold (same object gsc-archive uses). */
export async function getGscWeeklyGold(): Promise<{
  generated_at?: string;
  reports?: unknown[];
  [key: string]: unknown;
} | null> {
  return readJsonFromR2(GSC_WEEKLY_KEY);
}

/**
 * Lake-backed SEO payload for /api/admin/analytics/seo (and related).
 * No live GSC calls.
 */
export async function getSeoFromLake(days = 28): Promise<{
  snapshot: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    days: number;
  };
  keywords: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  fetchedAt: string;
  source: "datalake-gold";
  error?: string;
}> {
  void days;
  const section = await getGoldSection("top_keywords");
  const rows = section?.rows ?? [];
  const keywords = rows.map((r) => ({
    query: String(r.query ?? ""),
    clicks: Number(r.clicks) || 0,
    impressions: Number(r.impressions) || 0,
    ctr: Number(r.ctr) || 0,
    position: Number(r.avg_position ?? r.position) || 0,
  }));
  const clicks = keywords.reduce((a, k) => a + k.clicks, 0);
  const impressions = keywords.reduce((a, k) => a + k.impressions, 0);
  const positionSum = keywords.reduce((a, k) => a + k.position, 0);
  const snap = await loadDatalakeSnapshotFromR2();

  return {
    snapshot: {
      clicks,
      impressions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      position: keywords.length > 0 ? positionSum / keywords.length : 0,
      days,
    },
    keywords: keywords.slice(0, 50),
    fetchedAt: snap?.generated_at ?? new Date().toISOString(),
    source: "datalake-gold",
    error: section?.error,
  };
}

/**
 * CTR opportunities derived from gold top_keywords (pos 4–20, CTR < 5%, impressions ≥ 20).
 */
export async function getCtrOpportunitiesFromLake(limit = 50): Promise<{
  opportunities: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  fetchedAt: string;
  source: "datalake-gold";
  error?: string;
}> {
  const seo = await getSeoFromLake(28);
  const opportunities = seo.keywords
    .filter((k) => k.impressions >= 20 && k.ctr < 0.05 && k.position >= 4 && k.position <= 20)
    .slice(0, limit);
  return {
    opportunities,
    fetchedAt: seo.fetchedAt,
    source: "datalake-gold",
    error: seo.error,
  };
}

/**
 * Generic GSC dimension stub from gold — dimensions without silver rollups
 * return empty rows + note (never live GSC).
 */
export async function getGscDimensionFromLake(
  dimension: string,
  days = 28
): Promise<{
  dimension: string;
  rows: unknown[];
  snapshot: Awaited<ReturnType<typeof getSeoFromLake>>["snapshot"];
  fetchedAt: string;
  source: "datalake-gold";
  note: string;
  error?: string;
}> {
  const seo = await getSeoFromLake(days);
  return {
    dimension,
    rows: dimension === "query" ? seo.keywords : [],
    snapshot: seo.snapshot,
    fetchedAt: seo.fetchedAt,
    source: "datalake-gold",
    note:
      dimension === "query"
        ? "Served from gold top_keywords."
        : `Dimension "${dimension}" not yet in gold — extend materialize-datalake-snapshots. No live GSC.`,
    error: seo.error,
  };
}

/**
 * Lake-backed unified analytics — compose gold sections; no live vendors.
 */
export async function getUnifiedFromLake(days = 28): Promise<Record<string, unknown>> {
  const dash = await getGoldDashboard();
  const byName = new Map(dash.sections.map((s) => [s.section, s]));
  const seo = await getSeoFromLake(days);
  const stripe = byName.get("stripe_revenue");
  const espocrm = byName.get("espocrm_funnel");
  const attribution = byName.get("attribution");

  const stripeRows = stripe?.rows ?? [];
  const revenue = stripeRows.reduce((a, r) => a + (Number(r.revenue ?? r.amount) || 0), 0);

  return {
    days,
    fetchedAt: dash.generated_at,
    source: "datalake-gold",
    lakeSource: dash.source,
    seo: seo.error ? null : seo.snapshot,
    keywords: seo.keywords.slice(0, 10),
    pipeline: espocrm?.error
      ? null
      : {
          stages: espocrm?.rows ?? [],
          rowCount: espocrm?.rowCount ?? 0,
        },
    email: null,
    stripe: stripe?.error
      ? null
      : {
          totalOrders: stripe?.rowCount ?? 0,
          revenue,
          activeSubscriptions: null,
          mrr: null,
          rows: stripeRows.slice(0, 30),
        },
    attribution: attribution?.error ? null : attribution?.rows ?? [],
    sectionsMissing: dash.sections.filter((s) => s.error).map((s) => s.section),
  };
}

/**
 * Lake-backed ROI — LinkedIn ads + stripe_revenue gold only.
 * Other ad channels report configured=false until silver ETL lands.
 */
export async function getRoiFromLake(days = 30): Promise<Record<string, unknown>> {
  const linkedin = await getGoldSection("linkedin_ads");
  const stripe = await getGoldSection("stripe_revenue");
  const linkedinRows = linkedin?.rows ?? [];
  const spendCents = linkedinRows.reduce(
    (a, r) => a + Math.round((Number(r.spend ?? r.cost) || 0) * 100),
    0
  );
  const impressions = linkedinRows.reduce((a, r) => a + (Number(r.impressions) || 0), 0);
  const clicks = linkedinRows.reduce((a, r) => a + (Number(r.clicks) || 0), 0);
  const stripeRows = stripe?.rows ?? [];
  const revenueCents = Math.round(
    stripeRows.reduce((a, r) => a + (Number(r.revenue ?? r.amount) || 0), 0) * 100
  );

  const channels = [
    {
      channel: "linkedin",
      configured: !linkedin?.error && linkedinRows.length > 0,
      spendCents,
      impressions,
      clicks,
      platformLeads: linkedinRows.reduce((a, r) => a + (Number(r.leads ?? r.conversions) || 0), 0),
      error: linkedin?.error,
    },
    { channel: "google", configured: false, spendCents: 0, impressions: 0, clicks: 0, platformLeads: 0 },
    { channel: "tiktok", configured: false, spendCents: 0, impressions: 0, clicks: 0, platformLeads: 0 },
    { channel: "x", configured: false, spendCents: 0, impressions: 0, clicks: 0, platformLeads: 0 },
    { channel: "meta", configured: false, spendCents: 0, impressions: 0, clicks: 0, platformLeads: 0 },
  ];

  const totalsSpend = channels.reduce((a, c) => a + c.spendCents, 0);
  const totalsClicks = channels.reduce((a, c) => a + c.clicks, 0);
  const totalsImpressions = channels.reduce((a, c) => a + c.impressions, 0);
  const platformLeads = channels.reduce((a, c) => a + c.platformLeads, 0);

  return {
    windowDays: days,
    generatedAt: new Date().toISOString(),
    source: "datalake-gold",
    channels,
    totals: {
      spendCents: totalsSpend,
      impressions: totalsImpressions,
      clicks: totalsClicks,
      platformLeads,
      newLeads: null,
      revenueCents: stripe?.error ? null : revenueCents,
      costPerLeadCents: null,
      roas:
        totalsSpend > 0 && !stripe?.error ? Math.round((revenueCents / totalsSpend) * 100) / 100 : null,
    },
    notes: [
      "ROI is lake-backed. Google/TikTok/X/Meta channels appear when their silver ETL lands.",
      linkedin?.error ? `linkedin_ads: ${linkedin.error}` : null,
      stripe?.error ? `stripe_revenue: ${stripe.error}` : null,
    ].filter(Boolean),
  };
}

/**
 * KPI from gold SEO + revenue sections.
 */
export async function getKpiFromLake(days = 28): Promise<Record<string, unknown>> {
  const seo = await getSeoFromLake(days);
  const stripe = await getGoldSection("stripe_revenue");
  const funnel = await getGoldSection("acquisition_funnel");
  return {
    days,
    fetchedAt: seo.fetchedAt,
    source: "datalake-gold",
    seo: seo.snapshot,
    keywordsTop: seo.keywords.slice(0, 5),
    revenueRows: stripe?.rows?.slice(0, 14) ?? [],
    funnelRows: funnel?.rows?.slice(0, 14) ?? [],
    errors: [seo.error, stripe?.error, funnel?.error].filter(Boolean),
  };
}

/**
 * Build a StripeAnalyticsSnapshot-compatible object from gold stripe_revenue
 * for orchestration (no live Stripe API; no required D1 scan).
 */
export async function getStripeSnapshotFromLake(windowDays = 30): Promise<{
  windowDays: number;
  generatedAt: string;
  totals: {
    events: number;
    revenueMinor: number;
    processed: number;
    failed: number;
  };
  byCategory: Record<string, { events: number; revenueMinor: number }>;
  byStatus: Record<string, number>;
  byCurrency: Record<string, number>;
  dailyTrend: Array<{
    day: string;
    revenueMinor: number;
    events: number;
    processed: number;
    failed: number;
  }>;
  source: "datalake-gold";
  error?: string;
}> {
  const section = await getGoldSection("stripe_revenue");
  const rows = section?.rows ?? [];
  const dailyTrend = rows.map((r) => {
    const amountMajor = Number(r.revenue ?? r.amount) || 0;
    const events = Number(r.count ?? r.orders ?? r.events) || 0;
    return {
      day: String(r.day ?? r.date ?? r.period ?? ""),
      revenueMinor: Math.round(amountMajor * 100),
      events,
      processed: events,
      failed: 0,
    };
  });
  const totals = dailyTrend.reduce(
    (acc, d) => ({
      events: acc.events + d.events,
      revenueMinor: acc.revenueMinor + d.revenueMinor,
      processed: acc.processed + d.processed,
      failed: acc.failed + d.failed,
    }),
    { events: 0, revenueMinor: 0, processed: 0, failed: 0 }
  );
  const byCategory: Record<string, { events: number; revenueMinor: number }> = {};
  for (const r of rows) {
    if (r.category == null) continue;
    const cat = String(r.category);
    const cur = byCategory[cat] ?? { events: 0, revenueMinor: 0 };
    cur.events += Number(r.count ?? r.events) || 0;
    cur.revenueMinor += Math.round((Number(r.revenue ?? r.amount) || 0) * 100);
    byCategory[cat] = cur;
  }
  return {
    windowDays,
    generatedAt: new Date().toISOString(),
    totals,
    byCategory,
    byStatus: {},
    byCurrency: {},
    dailyTrend,
    source: "datalake-gold",
    error: section?.error,
  };
}
