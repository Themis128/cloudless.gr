import { getConfig } from "@/lib/ssm-config";
import { META_GRAPH_API_BASE, normalizeMetaAdAccountId } from "@/lib/meta-graph";

/**
 * Meta (Facebook/Instagram) Ads — read-only Marketing API insights.
 * Mirrors the google-ads/linkedin/tiktok/x-ads module pattern: silent
 * empty results on API errors, isMetaAdsConfigured() gate for 503s.
 *
 * Graph version comes from `@/lib/meta-graph` (bump there once).
 */

async function getMetaAdsConfig(): Promise<{ accessToken: string; adAccountId: string }> {
  const cfg = await getConfig();
  if (!cfg.META_ACCESS_TOKEN || !cfg.META_AD_ACCOUNT_ID) {
    throw new Error("Meta Ads not configured");
  }
  return {
    accessToken: cfg.META_ACCESS_TOKEN,
    adAccountId: normalizeMetaAdAccountId(cfg.META_AD_ACCOUNT_ID),
  };
}

async function metaFetch(path: string): Promise<Response> {
  const { accessToken } = await getMetaAdsConfig();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  // Prefer Authorization header so the token never lands in access-log URLs.
  return fetch(`${META_GRAPH_API_BASE}${normalized}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
}

export async function isMetaAdsConfigured(): Promise<boolean> {
  try {
    await getMetaAdsConfig();
    return true;
  } catch {
    return false;
  }
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  created_time: string;
  updated_time: string;
}

export async function listMetaCampaigns(): Promise<MetaCampaign[]> {
  try {
    const { adAccountId } = await getMetaAdsConfig();
    const fields = "id,name,status,objective,daily_budget,created_time,updated_time";
    const res = await metaFetch(`/${adAccountId}/campaigns?fields=${fields}&limit=25`);
    if (!res.ok) {
      console.error("[MetaAds] campaigns request failed:", res.status);
      return [];
    }
    const data = (await res.json()) as { data?: MetaCampaign[] };
    return data.data ?? [];
  } catch {
    return [];
  }
}

export interface MetaInsights {
  impressions: number;
  clicks: number;
  spend: number;
  /** Lead actions reported by Meta (lead + on-Facebook leads). */
  leads: number;
  ctr: number;
}

interface MetaInsightsRow {
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  actions?: Array<{ action_type: string; value: string }>;
}

const LEAD_ACTION_TYPES = new Set(["lead", "onsite_conversion.lead_grouped", "leadgen_grouped"]);

/**
 * Account-level insights for a date range (YYYY-MM-DD strings, inclusive).
 * Returns zeros when the API call fails — never throws.
 */
export async function getMetaInsights(dateStart: string, dateEnd: string): Promise<MetaInsights> {
  const empty: MetaInsights = { impressions: 0, clicks: 0, spend: 0, leads: 0, ctr: 0 };
  try {
    const { adAccountId } = await getMetaAdsConfig();
    const timeRange = encodeURIComponent(JSON.stringify({ since: dateStart, until: dateEnd }));
    const res = await metaFetch(
      `/${adAccountId}/insights?fields=impressions,clicks,spend,ctr,actions&time_range=${timeRange}`
    );
    if (!res.ok) {
      console.error("[MetaAds] insights request failed:", res.status);
      return empty;
    }
    const data = (await res.json()) as { data?: MetaInsightsRow[] };
    const row = data.data?.[0];
    if (!row) return empty;

    const leads = (row.actions ?? [])
      .filter((a) => LEAD_ACTION_TYPES.has(a.action_type))
      .reduce((sum, a) => sum + (Number.parseInt(a.value, 10) || 0), 0);

    return {
      impressions: Number.parseInt(row.impressions ?? "0", 10) || 0,
      clicks: Number.parseInt(row.clicks ?? "0", 10) || 0,
      spend: Number.parseFloat(row.spend ?? "0") || 0,
      leads,
      ctr: Number.parseFloat(row.ctr ?? "0") || 0,
    };
  } catch {
    return empty;
  }
}
