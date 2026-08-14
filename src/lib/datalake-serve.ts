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
import { mapGoldRowsForGscDimension } from "@/lib/gsc-dimension-gold";

const GSC_WEEKLY_KEY = "lake/snapshots/gsc-weekly.json";
const DATALAKE_GOLD_SOURCE = "datalake-gold" as const;
const SECTION_STRIPE_REVENUE = "stripe_revenue";
const SECTION_ACQUISITION_FUNNEL = "acquisition_funnel";

export async function getGoldSection(section: string): Promise<DatalakeSectionResult | null> {
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
  // R2 may hold a stub `{}` or a malformed index — always return a stable shape.
  if (index && Array.isArray(index.domains)) {
    return {
      generated_at:
        typeof index.generated_at === "string" && index.generated_at.length > 0
          ? index.generated_at
          : new Date().toISOString(),
      domains: index.domains,
    };
  }
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
  source: typeof DATALAKE_GOLD_SOURCE;
  error?: string;
}> {
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
    source: DATALAKE_GOLD_SOURCE,
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
  source: typeof DATALAKE_GOLD_SOURCE;
  error?: string;
}> {
  const seo = await getSeoFromLake(28);
  const opportunities = seo.keywords
    .filter((k) => k.impressions >= 20 && k.ctr < 0.05 && k.position >= 4 && k.position <= 20)
    .slice(0, limit);
  return {
    opportunities,
    fetchedAt: seo.fetchedAt,
    source: DATALAKE_GOLD_SOURCE,
    error: seo.error,
  };
}

/**
 * Generic GSC dimension from gold — never live GSC.
 */
export async function getGscDimensionFromLake(
  dimension: string,
  days = 28
): Promise<{
  dimension: string;
  rows: unknown[];
  snapshot: Awaited<ReturnType<typeof getSeoFromLake>>["snapshot"];
  fetchedAt: string;
  source: typeof DATALAKE_GOLD_SOURCE;
  note: string;
  error?: string;
}> {
  const seo = await getSeoFromLake(days);
  const [top_pages, gsc_countries, gsc_devices, gsc_query_pages] = await Promise.all([
    getGoldSection("top_pages"),
    getGoldSection("gsc_countries"),
    getGoldSection("gsc_devices"),
    getGoldSection("gsc_query_pages"),
  ]);
  const mapped = mapGoldRowsForGscDimension(dimension, {
    top_keywords: seo.keywords.map((k) => ({
      query: k.query,
      clicks: k.clicks,
      impressions: k.impressions,
      ctr: k.ctr,
      avg_position: k.position,
    })),
    top_pages: top_pages?.rows,
    gsc_countries: gsc_countries?.rows,
    gsc_devices: gsc_devices?.rows,
    gsc_query_pages: gsc_query_pages?.rows,
  });
  const sectionErrors = [
    top_pages?.error,
    gsc_countries?.error,
    gsc_devices?.error,
    gsc_query_pages?.error,
    seo.error,
  ].filter(Boolean);
  return {
    dimension,
    rows: mapped.rows,
    snapshot: seo.snapshot,
    fetchedAt: seo.fetchedAt,
    source: DATALAKE_GOLD_SOURCE,
    note: mapped.note,
    error: mapped.rows.length === 0 && sectionErrors.length > 0 ? String(sectionErrors[0]) : seo.error,
  };
}

/**
 * Lake-backed unified analytics — compose gold sections; no live vendors.
 */
export async function getUnifiedFromLake(days = 28): Promise<Record<string, unknown>> {
  const dash = await getGoldDashboard();
  const byName = new Map(dash.sections.map((s) => [s.section, s]));
  const seo = await getSeoFromLake(days);
  const stripe = byName.get(SECTION_STRIPE_REVENUE);
  const espocrm = byName.get("espocrm_funnel");
  const attribution = byName.get("attribution");

  const stripeRows = stripe?.rows ?? [];
  const paidOrders = stripeRows.find((r) => String(r.metric) === "paid_orders");
  const revenue = paidOrders
    ? Number(paidOrders.amount_eur ?? paidOrders.revenue ?? paidOrders.amount) || 0
    : stripeRows.reduce((a, r) => a + (Number(r.amount_eur ?? r.revenue ?? r.amount) || 0), 0);
  const totalOrders = paidOrders
    ? Number(paidOrders.value ?? paidOrders.count) || 0
    : (stripe?.rowCount ?? 0);

  return {
    days,
    fetchedAt: dash.generated_at,
    source: DATALAKE_GOLD_SOURCE,
    lakeSource: dash.source,
    seo: seo.error ? null : seo.snapshot,
    keywords: seo.keywords.slice(0, 10),
    pipeline: espocrm?.error ? null : pipelineFromEspocrmGold(espocrm?.rows ?? []),
    email: null,
    stripe: stripe?.error
      ? null
      : {
          totalOrders,
          revenue,
          activeSubscriptions: null,
          mrr: null,
          rows: stripeRows.slice(0, 30),
          dailyTrend: [],
        },
    attribution: attribution?.error ? null : (attribution?.rows ?? []),
    sectionsMissing: dash.sections.filter((s) => s.error).map((s) => s.section),
  };
}

/** Map gold espocrm_funnel (by lead source) into the Unified pipeline card shape. */
export function pipelineFromEspocrmGold(rows: Record<string, unknown>[]): {
  totalDeals: number;
  totalValue: number;
  byStage: Record<string, { count: number; value: number }>;
} {
  const byStage: Record<string, { count: number; value: number }> = {};
  let totalDeals = 0;
  let totalValue = 0;
  let totalContacts = 0;
  for (const r of rows) {
    const stage = String(r.lead_source ?? r.lifecycle_stage ?? "(none)");
    const deals = Number(r.closed_won_deals) || 0;
    const contacts = Number(r.contact_count) || 0;
    const value = Number(r.closed_won_revenue) || 0;
    byStage[stage] = { count: deals > 0 ? deals : contacts, value };
    totalDeals += deals;
    totalValue += value;
    totalContacts += contacts;
  }
  return {
    totalDeals: totalDeals > 0 ? totalDeals : totalContacts,
    totalValue,
    byStage,
  };
}

/**
 * Lake-backed ROI — LinkedIn ads + stripe_revenue gold only.
 * Other ad channels stay `configured: false` with `status: "not_in_gold"`
 * until a real silver ETL lands. Never calls live `roi.ts` adapters.
 */
export async function getRoiFromLake(days = 30): Promise<Record<string, unknown>> {
  const linkedin = await getGoldSection("linkedin_ads");
  const stripe = await getGoldSection(SECTION_STRIPE_REVENUE);
  const linkedinRows = linkedin?.rows ?? [];
  const spendCents = linkedinRows.reduce(
    (a, r) => a + Math.round((Number(r.spend ?? r.cost) || 0) * 100),
    0
  );
  const impressions = linkedinRows.reduce((a, r) => a + (Number(r.impressions) || 0), 0);
  const clicks = linkedinRows.reduce((a, r) => a + (Number(r.clicks) || 0), 0);
  const stripeRows = stripe?.rows ?? [];
  const paidOrders = stripeRows.find((r) => String(r.metric) === "paid_orders");
  const revenueMajor = paidOrders
    ? Number(paidOrders.amount_eur ?? paidOrders.revenue ?? paidOrders.amount) || 0
    : stripeRows.reduce((a, r) => a + (Number(r.amount_eur ?? r.revenue ?? r.amount) || 0), 0);
  const revenueCents = Math.round(revenueMajor * 100);

  const linkedinConfigured = !linkedin?.error && linkedinRows.length > 0;
  const notInGold = (channel: string) => ({
    channel,
    configured: false,
    inGold: false as const,
    status: "not_in_gold" as const,
    reason: "no silver parquet / gold section — ETL not wired; live roi.ts adapters stay off admin",
    spendCents: 0,
    impressions: 0,
    clicks: 0,
    platformLeads: 0,
  });

  const channels = [
    {
      channel: "linkedin",
      configured: linkedinConfigured,
      inGold: true as const,
      status: linkedinConfigured ? ("gold" as const) : ("empty_gold" as const),
      reason: linkedin?.error
        ? `linkedin_ads: ${linkedin.error}`
        : linkedinConfigured
          ? "Served from gold linkedin_ads"
          : "Gold section present but empty",
      spendCents,
      impressions,
      clicks,
      platformLeads: linkedinRows.reduce((a, r) => a + (Number(r.leads ?? r.conversions) || 0), 0),
      error: linkedin?.error,
    },
    notInGold("google"),
    notInGold("tiktok"),
    notInGold("x"),
    notInGold("meta"),
  ];

  const totalsSpend = channels.reduce((a, c) => a + c.spendCents, 0);
  const totalsClicks = channels.reduce((a, c) => a + c.clicks, 0);
  const totalsImpressions = channels.reduce((a, c) => a + c.impressions, 0);
  const platformLeads = channels.reduce((a, c) => a + c.platformLeads, 0);

  return {
    windowDays: days,
    generatedAt: new Date().toISOString(),
    source: DATALAKE_GOLD_SOURCE,
    goldSections: ["linkedin_ads", SECTION_STRIPE_REVENUE],
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
        totalsSpend > 0 && !stripe?.error
          ? Math.round((revenueCents / totalsSpend) * 100) / 100
          : null,
    },
    notes: [
      "ROI is lake-backed (LinkedIn + Stripe gold). Google/TikTok/X/Meta show as not_in_gold until their ETL exists.",
      "Live campaign adapters in roi.ts are not used on admin analytics routes.",
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
  const stripe = await getGoldSection(SECTION_STRIPE_REVENUE);
  const funnel = await getGoldSection(SECTION_ACQUISITION_FUNNEL);
  return {
    days,
    fetchedAt: seo.fetchedAt,
    source: DATALAKE_GOLD_SOURCE,
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
  source: typeof DATALAKE_GOLD_SOURCE;
  error?: string;
}> {
  const section = await getGoldSection(SECTION_STRIPE_REVENUE);
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
    source: DATALAKE_GOLD_SOURCE,
    error: section?.error,
  };
}
