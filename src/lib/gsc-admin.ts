/**
 * Google Search Console admin functions — write & inspection APIs.
 *
 * Extends gsc.ts (read-only Search Analytics) with:
 *   - Sitemap submission & listing
 *   - URL inspection (index status, coverage, mobile usability)
 *   - Request indexing via Google Indexing API
 *   - Crawl errors / coverage issues
 *
 * Auth uses the same service account as gsc.ts but requires two scopes:
 *   - webmasters (read/write sitemaps, URL inspection)
 *   - indexing (Google Indexing API notifications)
 */

import { createGoogleAuth } from "@/lib/google-auth";

const GSC_API = "https://searchconsole.googleapis.com/webmasters/v3/sites";
const INDEXING_API = "https://indexing.googleapis.com/v3/urlNotifications:publish";
const URL_INSPECTION_API = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const TIMEOUT_MS = 15_000;

const DEFAULT_SITE = process.env.GSC_SITE_URL ?? "https://cloudless.gr/";

// webmasters scope covers sitemaps + URL inspection; indexing scope is separate
const getWebmastersToken = createGoogleAuth("https://www.googleapis.com/auth/webmasters");
const getIndexingToken = createGoogleAuth("https://www.googleapis.com/auth/indexing");

async function fetchWithTimeout(url: string, opts: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SitemapEntry {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending: boolean;
  isSitemapsIndex: boolean;
  type: string;
  errors?: string;
  warnings?: string;
  contents?: Array<{ type: string; submitted: string; indexed: string }>;
}

export interface SitemapListResponse {
  sitemaps: SitemapEntry[];
  siteUrl: string;
}

export interface InspectionResult {
  inspectionResult: {
    inspectionStatus: string;
    indexStatusResult?: {
      verdict: string;
      coverageState: string;
      robotsTxtState: string;
      indexed?: boolean;
      lastCrawlTime?: string;
      pageFetchState: string;
      googleCanonical?: string;
      userCanonical?: string;
      sitemap?: string;
      crawledAs?: string;
      pageState?: string;
    };
    mobileUsabilityResult?: {
      verdict: string;
      issues?: Array<{ issueType: string; severity: string; message: string }>;
    };
    richResultsResult?: {
      verdict: string;
      detectedItems?: Array<{ richResultType: string; items: number }>;
    };
  };
}

export interface IndexingNotificationResponse {
  urlNotificationMetadata: {
    url: string;
    latestUpdate?: { url: string; type: string; notifyTime: string };
    latestRemove?: { url: string; type: string; notifyTime: string };
  };
}

// ─── Sitemaps ───────────────────────────────────────────────────────────────

/**
 * List all sitemaps submitted to GSC for the site.
 */
export async function listSitemaps(siteUrl = DEFAULT_SITE): Promise<SitemapListResponse> {
  const token = await getWebmastersToken();
  const encoded = encodeURIComponent(siteUrl);
  const res = await fetchWithTimeout(`${GSC_API}/${encoded}/sitemaps`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GSC sitemaps list ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { sitemap?: SitemapEntry[] };
  return {
    sitemaps: data.sitemap ?? [],
    siteUrl,
  };
}

/**
 * Submit a sitemap to GSC. If feedPath is omitted, submits /sitemap.xml.
 */
export async function submitSitemap(
  feedPath = "sitemap.xml",
  siteUrl = DEFAULT_SITE
): Promise<{ ok: true; path: string; siteUrl: string }> {
  const token = await getWebmastersToken();
  const encoded = encodeURIComponent(siteUrl);
  const feedEncoded = encodeURIComponent(feedPath);
  const res = await fetchWithTimeout(`${GSC_API}/${encoded}/sitemaps/${feedEncoded}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path: feedPath }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GSC sitemap submit ${res.status}: ${text.slice(0, 200)}`);
  }
  return { ok: true, path: feedPath, siteUrl };
}

/**
 * Delete a sitemap from GSC.
 */
export async function deleteSitemap(
  feedPath: string,
  siteUrl = DEFAULT_SITE
): Promise<{ ok: true; path: string }> {
  const token = await getWebmastersToken();
  const encoded = encodeURIComponent(siteUrl);
  const feedEncoded = encodeURIComponent(feedPath);
  const res = await fetchWithTimeout(`${GSC_API}/${encoded}/sitemaps/${feedEncoded}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GSC sitemap delete ${res.status}: ${text.slice(0, 200)}`);
  }
  return { ok: true, path: feedPath };
}

// ─── URL Inspection ──────────────────────────────────────────────────────────

/**
 * Inspect a URL's index status, coverage, and mobile usability via GSC.
 */
export async function inspectUrl(
  inspectionUrl: string,
  siteUrl = DEFAULT_SITE
): Promise<InspectionResult> {
  const token = await getWebmastersToken();
  const res = await fetchWithTimeout(URL_INSPECTION_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      inspectionUrl,
      siteUrl,
      languageCode: "en-US",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GSC URL inspection ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as InspectionResult;
}

// ─── Request Indexing (Google Indexing API) ─────────────────────────────────

/**
 * Notify Google that a URL has been updated and should be re-crawled.
 * Uses the Google Indexing API (separate from GSC).
 */
export async function requestIndexing(url: string): Promise<IndexingNotificationResponse> {
  const token = await getIndexingToken();
  const res = await fetchWithTimeout(INDEXING_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      type: "URL_UPDATED",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Indexing API ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as IndexingNotificationResponse;
}

/**
 * Get the status of the most recent indexing notification for a URL.
 */
export async function getIndexingStatus(url: string): Promise<IndexingNotificationResponse> {
  const token = await getIndexingToken();
  const encoded = encodeURIComponent(url);
  const res = await fetchWithTimeout(`${INDEXING_API}/metadata?url=${encoded}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Indexing API status ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as IndexingNotificationResponse;
}

// ─── Crawl Stats ─────────────────────────────────────────────────────────────

export interface CrawlStatsSample {
  url: string;
  lastCrawlTime?: string;
  responseState?: string;
  crawlState?: string;
  robotsTxtState?: string;
}

export interface CrawlStatsSummary {
  category: string;
  pageCount: number;
  sampleUrls: CrawlStatsSample[];
}

/**
 * Get crawl stats samples for a site (errors, soft404s, ok pages).
 * Uses the GSC Crawl Stats API (available since 2023).
 */
export async function getCrawlStats(
  siteUrl = DEFAULT_SITE
): Promise<{ samples: CrawlStatsSummary[]; siteUrl: string }> {
  const token = await getWebmastersToken();
  const encoded = encodeURIComponent(siteUrl);

  const categories = ["not_found", "server_error", "soft_404", "ok"];
  const samples: CrawlStatsSummary[] = [];

  for (const category of categories) {
    try {
      const res = await fetchWithTimeout(
        `${GSC_API}/${encoded}/crawlStatsSamples?category=${category}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { samples?: CrawlStatsSample[] };
      const urls = data.samples ?? [];
      if (urls.length > 0) {
        samples.push({
          category,
          pageCount: urls.length,
          sampleUrls: urls.slice(0, 10),
        });
      }
    } catch {
      // Individual category failures are non-fatal
    }
  }

  return { samples, siteUrl };
}
