import { getConfig } from "@/lib/ssm-config";

/**
 * Meta (Facebook/Instagram) Ads — read-only Marketing API insights.
 * Mirrors the google-ads/linkedin/tiktok/x-ads module pattern: silent
 * empty results on API errors, isMetaAdsConfigured() gate for 503s.
 *
 * Same Graph API version as meta-capi.ts — bump both together.
 */
const GRAPH_API_VERSION = "v19.0";
const GRAPH_API = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

async function getMetaAdsConfig(): Promise<{ accessToken: string; adAccountId: string }> {
  const cfg = await getConfig();
  if (!cfg.META_ACCESS_TOKEN || !cfg.META_AD_ACCOUNT_ID) {
    throw new Error("Meta Ads not configured");
  }
  // Account IDs in the Marketing API are prefixed with "act_".
  const adAccountId = cfg.META_AD_ACCOUNT_ID.startsWith("act_")
    ? cfg.META_AD_ACCOUNT_ID
    : `act_${cfg.META_AD_ACCOUNT_ID}`;
  return { accessToken: cfg.META_ACCESS_TOKEN, adAccountId };
}

async function metaFetch(path: string): Promise<Response> {
  const { accessToken } = await getMetaAdsConfig();
  const sep = path.includes("?") ? "&" : "?";
  return fetch(`${GRAPH_API}${path}${sep}access_token=${encodeURIComponent(accessToken)}`, {
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
    const data = (((await res.json()) as any)) as { data?: MetaCampaign[] };
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
    const data = (((await res.json()) as any)) as { data?: MetaInsightsRow[] };
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
