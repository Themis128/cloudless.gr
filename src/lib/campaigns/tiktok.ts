import { getConfig } from "@/lib/ssm-config";

const TIKTOK_API = "https://business-api.tiktok.com/open_api/v1.3";

async function getTikTokConfig(): Promise<{
  token: string;
  advertiserId: string;
}> {
  const cfg = await getConfig();
  const token = cfg.TIKTOK_ACCESS_TOKEN;
  const advertiserId = cfg.TIKTOK_ADVERTISER_ID;
  if (!token || !advertiserId) throw new Error("TikTok not configured");
  return { token, advertiserId };
}

async function ttFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const { token } = await getTikTokConfig();
  return fetch(`${TIKTOK_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Access-Token": token,
      ...options.headers,
    },
  });
}

export async function isTikTokConfigured(): Promise<boolean> {
  try {
    await getTikTokConfig();
    return true;
  } catch {
    return false;
  }
}

export interface TikTokCampaign {
  campaign_id: string;
  campaign_name: string;
  status: string;
  objective_type: string;
  budget: string;
  budget_mode: string;
  create_time: string;
  modify_time: string;
}

export async function listTikTokCampaigns(): Promise<TikTokCampaign[]> {
  try {
    const { advertiserId } = await getTikTokConfig();
    const res = await ttFetch(
      `/campaign/get/?advertiser_id=${advertiserId}&page_size=20`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.data?.list ?? [];
  } catch {
    return [];
  }
}

export interface TikTokInsights {
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  conversions: string;
}

export async function getTikTokInsights(
  dateStart: string,
  dateEnd: string,
): Promise<TikTokInsights> {
  const empty: TikTokInsights = {
    spend: "0",
    impressions: "0",
    clicks: "0",
    ctr: "0",
    cpc: "0",
    conversions: "0",
  };
  try {
    const { advertiserId } = await getTikTokConfig();
    const body = {
      advertiser_id: advertiserId,
      report_type: "BASIC",
      data_level: "AUCTION_ADVERTISER",
      dimensions: ["stat_time_day"],
      metrics: ["spend", "impressions", "clicks", "ctr", "cpc", "conversion"],
      start_date: dateStart,
      end_date: dateEnd,
      page_size: 1,
    };
    const res = await ttFetch("/report/integrated/get/", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) return empty;
    const data = await res.json();
    const rows: Record<string, Record<string, string>>[] =
      data.data?.list ?? [];
    if (rows.length === 0) return empty;
    const metrics: Record<string, string> =
      (rows[0].metrics as Record<string, string>) ?? {};
    return {
      spend: metrics.spend ?? "0",
      impressions: metrics.impressions ?? "0",
      clicks: metrics.clicks ?? "0",
      ctr: metrics.ctr ?? "0",
      cpc: metrics.cpc ?? "0",
      conversions: metrics.conversion ?? "0",
    };
  } catch {
    return empty;
  }
}
