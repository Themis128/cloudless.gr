/**
 * Google Search Console API client.
 *
 * Uses the existing Google service account stored in SSM
 * (GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY) — the same credentials
 * already used for Google Calendar.
 *
 * Pre-requisite (one-time setup):
 *  1. Enable "Google Search Console API" in your GCP project.
 *  2. In GSC → Settings → Users and permissions → Add user:
 *     paste your service account email, set role "Full".
 */

import { getConfig } from "@/lib/ssm-config";

const GSC_API = "https://searchconsole.googleapis.com/v1/sites";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

/** Default GSC property — domain property covers all subdomains & protocols. */
const DEFAULT_SITE = process.env.GSC_SITE_URL ?? "sc-domain:cloudless.gr";

/** 28-day rolling window (GSC standard reporting period). */
function dateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 28);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

/* ------------------------------------------------------------------ */
/*  Auth                                                               */
/* ------------------------------------------------------------------ */

let cachedToken: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token;
  }

  const config = await getConfig();
  const email = config.GOOGLE_CLIENT_EMAIL;
  const key = config.GOOGLE_PRIVATE_KEY;
  if (!email || !key) throw new Error("Google service account not configured");

  const { SignJWT, importPKCS8 } = await import("jose");
  const now = Math.floor(Date.now() / 1000);
  const privateKey = await importPKCS8(key, "RS256");

  const jwt = await new SignJWT({ iss: email, scope: SCOPE, aud: TOKEN_URL })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) throw new Error(`Google token error: ${res.status}`);
  const data = await res.json();

  cachedToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

/* ------------------------------------------------------------------ */
/*  Low-level fetch                                                    */
/* ------------------------------------------------------------------ */

async function gscQuery(siteUrl: string, body: object): Promise<Response> {
  const token = await getAccessToken();
  const encoded = encodeURIComponent(siteUrl);
  return fetch(`${GSC_API}/${encoded}/searchAnalytics/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SeoSnapshot {
  /** Total organic clicks (last 28 days) */
  clicks: number;
  /** Total organic impressions (last 28 days) */
  impressions: number;
  /** Average click-through rate in % (e.g. 3.5 = 3.5%) */
  ctr: number;
  /** Average ranking position */
  avgPosition: number;
  /** Number of unique organic keywords */
  organicKeywords: number;
}

export interface KeywordData {
  keyword: string;
  clicks: number;
  impressions: number;
  /** CTR in % */
  ctr: number;
  position: number;
}

export interface WebAnalyticsData {
  clicks: number;
  impressions: number;
  /** CTR in % */
  ctr: number;
  avgPosition: number;
  topPages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    position: number;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Overall SEO performance snapshot (28-day rolling window).
 */
export async function getSeoSnapshot(
  siteUrl = DEFAULT_SITE,
): Promise<SeoSnapshot | null> {
  try {
    const range = dateRange();

    // Aggregate totals (no dimensions = single summary row)
    const totalsRes = await gscQuery(siteUrl, {
      ...range,
      dimensions: [],
      rowLimit: 1,
    });

    if (!totalsRes.ok) {
      console.error("[GSC] Overview error:", await totalsRes.text());
      return null;
    }
    const totals = await totalsRes.json();
    const row = totals.rows?.[0] ?? {};

    // Count unique keywords
    const kwRes = await gscQuery(siteUrl, {
      ...range,
      dimensions: ["query"],
      rowLimit: 25000, // GSC max
    });
    const kwData = kwRes.ok ? await kwRes.json() : {};
    const organicKeywords: number = kwData.rows?.length ?? 0;

    return {
      clicks: Math.round(row.clicks ?? 0),
      impressions: Math.round(row.impressions ?? 0),
      ctr: parseFloat(((row.ctr ?? 0) * 100).toFixed(2)),
      avgPosition: parseFloat((row.position ?? 0).toFixed(1)),
      organicKeywords,
    };
  } catch (err) {
    console.error("[GSC] getSeoSnapshot error:", err);
    return null;
  }
}

/**
 * Top organic keywords sorted by clicks (28-day rolling window).
 */
export async function getTopKeywords(
  siteUrl = DEFAULT_SITE,
  limit = 20,
): Promise<KeywordData[]> {
  try {
    const res = await gscQuery(siteUrl, {
      ...dateRange(),
      dimensions: ["query"],
      rowLimit: limit,
      orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
    });

    if (!res.ok) return [];
    const data = await res.json();

    return (data.rows ?? []).map((r: Record<string, unknown>) => ({
      keyword: (r.keys as string[])?.[0] ?? "",
      clicks: Math.round((r.clicks as number) ?? 0),
      impressions: Math.round((r.impressions as number) ?? 0),
      ctr: parseFloat((((r.ctr as number) ?? 0) * 100).toFixed(2)),
      position: parseFloat(((r.position as number) ?? 0).toFixed(1)),
    }));
  } catch (err) {
    console.error("[GSC] getTopKeywords error:", err);
    return [];
  }
}

export interface PerformancePoint {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

export interface PageData {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Weekly performance history for trend charts.
 * @param weeks  Number of weeks back to fetch (default 12 = ~3 months)
 */
export async function getPerformanceHistory(
  siteUrl = DEFAULT_SITE,
  weeks = 12,
): Promise<PerformancePoint[]> {
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - weeks * 7);

    const res = await gscQuery(siteUrl, {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ["date"],
      rowLimit: weeks * 7,
    });

    if (!res.ok) return [];
    const data = await res.json();

    return (data.rows ?? []).map((r: Record<string, unknown>) => ({
      date: (r.keys as string[])?.[0] ?? "",
      clicks: Math.round((r.clicks as number) ?? 0),
      impressions: Math.round((r.impressions as number) ?? 0),
      ctr: parseFloat((((r.ctr as number) ?? 0) * 100).toFixed(2)),
      avgPosition: parseFloat(((r.position as number) ?? 0).toFixed(1)),
    }));
  } catch (err) {
    console.error("[GSC] getPerformanceHistory error:", err);
    return [];
  }
}

/**
 * Top pages by organic clicks.
 */
export async function getTopPages(
  siteUrl = DEFAULT_SITE,
  limit = 25,
): Promise<PageData[]> {
  try {
    const res = await gscQuery(siteUrl, {
      ...dateRange(),
      dimensions: ["page"],
      rowLimit: limit,
      orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
    });

    if (!res.ok) return [];
    const data = await res.json();

    return (data.rows ?? []).map((r: Record<string, unknown>) => ({
      page: (r.keys as string[])?.[0] ?? "",
      clicks: Math.round((r.clicks as number) ?? 0),
      impressions: Math.round((r.impressions as number) ?? 0),
      ctr: parseFloat((((r.ctr as number) ?? 0) * 100).toFixed(2)),
      position: parseFloat(((r.position as number) ?? 0).toFixed(1)),
    }));
  } catch (err) {
    console.error("[GSC] getTopPages error:", err);
    return [];
  }
}

/**
 * Top pages by organic clicks — used as a web analytics proxy.
 */
export async function getWebAnalytics(
  siteUrl = DEFAULT_SITE,
): Promise<WebAnalyticsData | null> {
  try {
    const range = dateRange();

    // Site-wide totals
    const totalsRes = await gscQuery(siteUrl, {
      ...range,
      dimensions: [],
      rowLimit: 1,
    });

    const totalsData = totalsRes.ok ? await totalsRes.json() : {};
    const total = totalsData.rows?.[0] ?? {};

    // Top pages
    const pagesRes = await gscQuery(siteUrl, {
      ...range,
      dimensions: ["page"],
      rowLimit: 20,
      orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
    });

    const pagesData = pagesRes.ok ? await pagesRes.json() : {};
    const topPages = (pagesData.rows ?? []).map(
      (r: Record<string, unknown>) => ({
        page: (r.keys as string[])?.[0] ?? "",
        clicks: Math.round((r.clicks as number) ?? 0),
        impressions: Math.round((r.impressions as number) ?? 0),
        position: parseFloat(((r.position as number) ?? 0).toFixed(1)),
      }),
    );

    return {
      clicks: Math.round(total.clicks ?? 0),
      impressions: Math.round(total.impressions ?? 0),
      ctr: parseFloat(((total.ctr ?? 0) * 100).toFixed(2)),
      avgPosition: parseFloat((total.position ?? 0).toFixed(1)),
      topPages,
    };
  } catch (err) {
    console.error("[GSC] getWebAnalytics error:", err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  CTR Opportunities                                                  */
/* ------------------------------------------------------------------ */

export interface CtrOpportunity {
  keyword: string;
  clicks: number;
  impressions: number;
  /** CTR in % */
  ctr: number;
  position: number;
}

/**
 * Keywords ranking position 4–20 with high impressions but low CTR (<5%).
 * These represent optimisation opportunities (better titles/descriptions).
 */
export async function getCtrOpportunities(
  siteUrl = DEFAULT_SITE,
  limit = 50,
): Promise<CtrOpportunity[]> {
  try {
    const res = await gscQuery(siteUrl, {
      ...dateRange(),
      dimensions: ["query"],
      rowLimit: 25000,
    });

    if (!res.ok) return [];
    const data = await res.json();

    const opportunities = (data.rows ?? [])
      .filter((r: Record<string, unknown>) => {
        const position = (r.position as number) ?? 0;
        const ctr = ((r.ctr as number) ?? 0) * 100;
        const impressions = (r.impressions as number) ?? 0;
        return position >= 4 && position <= 20 && ctr < 5 && impressions > 10;
      })
      .sort(
        (a: Record<string, unknown>, b: Record<string, unknown>) =>
          ((b.impressions as number) ?? 0) - ((a.impressions as number) ?? 0),
      )
      .slice(0, limit)
      .map((r: Record<string, unknown>) => ({
        keyword: (r.keys as string[])?.[0] ?? "",
        clicks: Math.round((r.clicks as number) ?? 0),
        impressions: Math.round((r.impressions as number) ?? 0),
        ctr: parseFloat((((r.ctr as number) ?? 0) * 100).toFixed(2)),
        position: parseFloat(((r.position as number) ?? 0).toFixed(1)),
      }));

    return opportunities;
  } catch (err) {
    console.error("[GSC] getCtrOpportunities error:", err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Device Breakdown                                                   */
/* ------------------------------------------------------------------ */

export interface DeviceData {
  device: string;
  clicks: number;
  impressions: number;
  /** CTR in % */
  ctr: number;
  avgPosition: number;
}

/**
 * Search performance breakdown by device type (DESKTOP, MOBILE, TABLET).
 */
export async function getDeviceBreakdown(
  siteUrl = DEFAULT_SITE,
): Promise<DeviceData[]> {
  try {
    const res = await gscQuery(siteUrl, {
      ...dateRange(),
      dimensions: ["device"],
      rowLimit: 10,
    });

    if (!res.ok) return [];
    const data = await res.json();

    return (data.rows ?? []).map((r: Record<string, unknown>) => ({
      device: (r.keys as string[])?.[0] ?? "",
      clicks: Math.round((r.clicks as number) ?? 0),
      impressions: Math.round((r.impressions as number) ?? 0),
      ctr: parseFloat((((r.ctr as number) ?? 0) * 100).toFixed(2)),
      avgPosition: parseFloat(((r.position as number) ?? 0).toFixed(1)),
    }));
  } catch (err) {
    console.error("[GSC] getDeviceBreakdown error:", err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Product Page Metrics                                               */
/* ------------------------------------------------------------------ */

export interface ProductPageData {
  page: string;
  clicks: number;
  impressions: number;
  /** CTR in % */
  ctr: number;
  position: number;
}

/**
 * Page-level metrics filtered by URL pattern (e.g. "/store/").
 * Useful to isolate product / e-commerce page performance.
 */
export async function getProductPageMetrics(
  siteUrl = DEFAULT_SITE,
  urlPattern = "/store/",
  limit = 50,
): Promise<ProductPageData[]> {
  try {
    const res = await gscQuery(siteUrl, {
      ...dateRange(),
      dimensions: ["page"],
      dimensionFilterGroups: [
        {
          filters: [
            {
              dimension: "page",
              operator: "contains",
              expression: urlPattern,
            },
          ],
        },
      ],
      rowLimit: limit,
      orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
    });

    if (!res.ok) return [];
    const data = await res.json();

    return (data.rows ?? []).map((r: Record<string, unknown>) => ({
      page: (r.keys as string[])?.[0] ?? "",
      clicks: Math.round((r.clicks as number) ?? 0),
      impressions: Math.round((r.impressions as number) ?? 0),
      ctr: parseFloat((((r.ctr as number) ?? 0) * 100).toFixed(2)),
      position: parseFloat(((r.position as number) ?? 0).toFixed(1)),
    }));
  } catch (err) {
    console.error("[GSC] getProductPageMetrics error:", err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Query → Page Mapping                                               */
/* ------------------------------------------------------------------ */

export interface QueryPageMapping {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  /** CTR in % */
  ctr: number;
  position: number;
}

/**
 * Which search queries land on which pages.
 * Useful for detecting keyword cannibalisation.
 */
export async function getQueryPageMapping(
  siteUrl = DEFAULT_SITE,
  limit = 100,
): Promise<QueryPageMapping[]> {
  try {
    const res = await gscQuery(siteUrl, {
      ...dateRange(),
      dimensions: ["query", "page"],
      rowLimit: limit,
      orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
    });

    if (!res.ok) return [];
    const data = await res.json();

    return (data.rows ?? []).map((r: Record<string, unknown>) => ({
      query: (r.keys as string[])?.[0] ?? "",
      page: (r.keys as string[])?.[1] ?? "",
      clicks: Math.round((r.clicks as number) ?? 0),
      impressions: Math.round((r.impressions as number) ?? 0),
      ctr: parseFloat((((r.ctr as number) ?? 0) * 100).toFixed(2)),
      position: parseFloat(((r.position as number) ?? 0).toFixed(1)),
    }));
  } catch (err) {
    console.error("[GSC] getQueryPageMapping error:", err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Search Intent Breakdown                                            */
/* ------------------------------------------------------------------ */

export interface IntentKeyword {
  keyword: string;
  clicks: number;
  impressions: number;
  /** CTR in % */
  ctr: number;
  position: number;
}

export interface SearchIntentBreakdown {
  brand: IntentKeyword[];
  product: IntentKeyword[];
  informational: IntentKeyword[];
  navigational: IntentKeyword[];
}

/**
 * Categorise top keywords by inferred search intent.
 *
 * Heuristic buckets:
 *  - brand:          contains the brand name ("cloudless")
 *  - product:        purchase-intent words (buy, price, order, shipping, store, shop, product)
 *  - informational:  knowledge-seeking (how, what, why, guide, tutorial, tips, learn, blog)
 *  - navigational:   everything else (looking for a specific site/page)
 */
export async function getSearchIntentBreakdown(
  siteUrl = DEFAULT_SITE,
): Promise<SearchIntentBreakdown> {
  const empty: SearchIntentBreakdown = {
    brand: [],
    product: [],
    informational: [],
    navigational: [],
  };

  try {
    const res = await gscQuery(siteUrl, {
      ...dateRange(),
      dimensions: ["query"],
      rowLimit: 25000,
    });

    if (!res.ok) return empty;
    const data = await res.json();

    const brandRe = /cloudless/i;
    const productRe =
      /\b(buy|price|order|shipping|store|shop|product|purchase|deal|discount|coupon)\b/i;
    const infoRe =
      /\b(how|what|why|when|where|guide|tutorial|tips|learn|blog|article|example|comparison|vs|review)\b/i;

    const toKeyword = (r: Record<string, unknown>): IntentKeyword => ({
      keyword: (r.keys as string[])?.[0] ?? "",
      clicks: Math.round((r.clicks as number) ?? 0),
      impressions: Math.round((r.impressions as number) ?? 0),
      ctr: parseFloat((((r.ctr as number) ?? 0) * 100).toFixed(2)),
      position: parseFloat(((r.position as number) ?? 0).toFixed(1)),
    });

    const result: SearchIntentBreakdown = {
      brand: [],
      product: [],
      informational: [],
      navigational: [],
    };

    for (const row of data.rows ?? []) {
      const kw = (row.keys as string[])?.[0] ?? "";
      const mapped = toKeyword(row);

      if (brandRe.test(kw)) {
        result.brand.push(mapped);
      } else if (productRe.test(kw)) {
        result.product.push(mapped);
      } else if (infoRe.test(kw)) {
        result.informational.push(mapped);
      } else {
        result.navigational.push(mapped);
      }
    }

    // Sort each bucket by impressions descending
    const sortByImpressions = (a: IntentKeyword, b: IntentKeyword) =>
      b.impressions - a.impressions;

    result.brand.sort(sortByImpressions);
    result.product.sort(sortByImpressions);
    result.informational.sort(sortByImpressions);
    result.navigational.sort(sortByImpressions);

    return result;
  } catch (err) {
    console.error("[GSC] getSearchIntentBreakdown error:", err);
    return empty;
  }
}

/* ------------------------------------------------------------------ */
/*  Traffic by Country                                                 */
/* ------------------------------------------------------------------ */

export interface CountryTraffic {
  country: string;
  clicks: number;
  impressions: number;
  /** CTR in % */
  ctr: number;
  avgPosition: number;
}

/**
 * Organic search traffic breakdown by country (ISO 3166-1 alpha-3).
 */
export async function getTrafficByCountry(
  siteUrl = DEFAULT_SITE,
  limit = 30,
): Promise<CountryTraffic[]> {
  try {
    const res = await gscQuery(siteUrl, {
      ...dateRange(),
      dimensions: ["country"],
      rowLimit: limit,
      orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
    });

    if (!res.ok) return [];
    const data = await res.json();

    return (data.rows ?? []).map((r: Record<string, unknown>) => ({
      country: (r.keys as string[])?.[0] ?? "",
      clicks: Math.round((r.clicks as number) ?? 0),
      impressions: Math.round((r.impressions as number) ?? 0),
      ctr: parseFloat((((r.ctr as number) ?? 0) * 100).toFixed(2)),
      avgPosition: parseFloat(((r.position as number) ?? 0).toFixed(1)),
    }));
  } catch (err) {
    console.error("[GSC] getTrafficByCountry error:", err);
    return [];
  }
}
