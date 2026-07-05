import { getConfig } from "@/lib/ssm-config";

const TIKTOK_API = "https://business-api.tiktok.com/open_api/v1.3";

// ---------------------------------------------------------------------------
// Pure helpers (exported for testability)
// ---------------------------------------------------------------------------

export interface TikTokInsights {
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  conversions: string;
}

export function emptyInsights(): TikTokInsights {
  return { spend: "0", impressions: "0", clicks: "0", ctr: "0", cpc: "0", conversions: "0" };
}

/** Raw TikTok report row shape (metrics nested under a `metrics` key). */
export interface TikTokReportRow {
  metrics?: Record<string, string>;
}

/** Parse a TikTok report row into the normalized TikTokInsights shape. */
export function parseInsightsRow(row: TikTokReportRow | null | undefined): TikTokInsights {
  if (!row?.metrics) return emptyInsights();
  const m = row.metrics;
  return {
    spend: m.spend ?? "0",
    impressions: m.impressions ?? "0",
    clicks: m.clicks ?? "0",
    ctr: m.ctr ?? "0",
    cpc: m.cpc ?? "0",
    conversions: m.conversion ?? "0",
  };
}

/** Build the insights request body for the TikTok reporting API. */
export function buildInsightsRequestBody(
  advertiserId: string,
  dateStart: string,
  dateEnd: string
): Record<string, unknown> {
  return {
    advertiser_id: advertiserId,
    report_type: "BASIC",
    data_level: "AUCTION_ADVERTISER",
    dimensions: ["stat_time_day"],
    metrics: ["spend", "impressions", "clicks", "ctr", "cpc", "conversion"],
    start_date: dateStart,
    end_date: dateEnd,
    page_size: 1,
  };
}

// ---------------------------------------------------------------------------
// I/O layer (adapters)
// ---------------------------------------------------------------------------

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

async function ttFetch(path: string, options: RequestInit = {}): Promise<Response> {
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
    const res = await ttFetch(`/campaign/get/?advertiser_id=${advertiserId}&page_size=20`);
    if (!res.ok) return [];
    const data = ((await res.json()) as any);
    return data.data?.list ?? [];
  } catch {
    return [];
  }
}

export async function getTikTokInsights(
  dateStart: string,
  dateEnd: string
): Promise<TikTokInsights> {
  try {
    const { advertiserId } = await getTikTokConfig();
    const body = buildInsightsRequestBody(advertiserId, dateStart, dateEnd);
    const res = await ttFetch("/report/integrated/get/", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) return emptyInsights();
    const data = ((await res.json()) as any);
    const rows: TikTokReportRow[] = data.data?.list ?? [];
    if (rows.length === 0) return emptyInsights();
    return parseInsightsRow(rows[0]);
  } catch {
    return emptyInsights();
  }
}
