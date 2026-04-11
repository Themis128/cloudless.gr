import { getIntegrations } from "@/lib/integrations";

const AHREFS_API = "https://api.ahrefs.com/v3";

async function ahrefsFetch(path: string): Promise<Response> {
  const { AHREFS_API_KEY } = getIntegrations();
  if (!AHREFS_API_KEY) throw new Error("Ahrefs not configured");

  return fetch(`${AHREFS_API}${path}`, {
    headers: {
      Authorization: `Bearer ${AHREFS_API_KEY}`,
      Accept: "application/json",
    },
  });
}

export interface SeoSnapshot {
  domainRating: number;
  organicKeywords: number;
  organicTraffic: number;
  backlinks: number;
  referringDomains: number;
}

/** Get domain-level SEO metrics */
export async function getSeoSnapshot(
  domain = "cloudless.gr",
): Promise<SeoSnapshot | null> {
  try {
    const res = await ahrefsFetch(
      `/site-explorer/overview?target=${encodeURIComponent(domain)}&mode=domain`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      domainRating: data.domain_rating ?? 0,
      organicKeywords: data.organic_keywords ?? 0,
      organicTraffic: data.organic_traffic ?? 0,
      backlinks: data.backlinks ?? 0,
      referringDomains: data.referring_domains ?? 0,
    };
  } catch (err) {
    console.error("[Ahrefs] Error:", err);
    return null;
  }
}

export interface KeywordData {
  keyword: string;
  volume: number;
  position: number;
  url: string;
  traffic: number;
}

/** Get top organic keywords */
export async function getTopKeywords(
  domain = "cloudless.gr",
  limit = 20,
): Promise<KeywordData[]> {
  try {
    const res = await ahrefsFetch(
      `/site-explorer/organic-keywords?target=${encodeURIComponent(domain)}&mode=domain&limit=${limit}&order_by=traffic_desc`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.keywords ?? []).map((k: Record<string, unknown>) => ({
      keyword: k.keyword ?? "",
      volume: k.volume ?? 0,
      position: k.position ?? 0,
      url: k.url ?? "",
      traffic: k.traffic ?? 0,
    }));
  } catch {
    return [];
  }
}

export interface WebAnalyticsData {
  pageviews: number;
  visitors: number;
  visits: number;
  bounceRate: number;
  avgDuration: number;
}

/** Get web analytics overview */
export async function getWebAnalytics(
  domain = "cloudless.gr",
): Promise<WebAnalyticsData | null> {
  try {
    const res = await ahrefsFetch(
      `/web-analytics/stats?target=${encodeURIComponent(domain)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      pageviews: data.pageviews ?? 0,
      visitors: data.visitors ?? 0,
      visits: data.visits ?? 0,
      bounceRate: data.bounce_rate ?? 0,
      avgDuration: data.avg_visit_duration ?? 0,
    };
  } catch {
    return null;
  }
}
