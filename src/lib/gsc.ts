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
  } catch {
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
  } catch {
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
  } catch {
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
    const topPages = (pagesData.rows ?? []).map((r: Record<string, unknown>) => ({
      page: (r.keys as string[])?.[0] ?? "",
      clicks: Math.round((r.clicks as number) ?? 0),
      impressions: Math.round((r.impressions as number) ?? 0),
      position: parseFloat(((r.position as number) ?? 0).toFixed(1)),
    }));

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
