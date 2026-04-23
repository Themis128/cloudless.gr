import { getConfig } from "@/lib/ssm-config";
import { createHmac } from "crypto";

const X_ADS_API = "https://ads-api.x.com/12";

async function getXConfig(): Promise<{
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
  adAccountId: string;
}> {
  const cfg = await getConfig();
  if (!cfg.X_API_KEY || !cfg.X_ACCESS_TOKEN) throw new Error("X not configured");
  return {
    apiKey: cfg.X_API_KEY,
    apiSecret: cfg.X_API_SECRET,
    accessToken: cfg.X_ACCESS_TOKEN,
    accessSecret: cfg.X_ACCESS_SECRET,
    adAccountId: cfg.X_AD_ACCOUNT_ID,
  };
}

function buildOAuthHeader(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessSecret: string,
): string {
  const nonce = Math.random().toString(36).substring(2);
  const ts = Math.floor(Date.now() / 1000).toString();
  const params: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: ts,
    oauth_token: accessToken,
    oauth_version: "1.0",
  };
  const paramStr = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");
  const baseStr = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
  const sigKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`;
  const sig = createHmac("sha1", sigKey).update(baseStr).digest("base64");
  params.oauth_signature = sig;
  const header =
    "OAuth " +
    Object.keys(params)
      .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
      .join(", ");
  return header;
}

async function xFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const cfg = await getXConfig();
  const url = `${X_ADS_API}${path}`;
  const method = (options.method ?? "GET").toUpperCase();
  const auth = buildOAuthHeader(
    method,
    url,
    cfg.apiKey,
    cfg.apiSecret,
    cfg.accessToken,
    cfg.accessSecret,
  );
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
      ...options.headers,
    },
  });
}

export async function isXConfigured(): Promise<boolean> {
  try {
    await getXConfig();
    return true;
  } catch {
    return false;
  }
}

export interface XCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget_amount_local_micro: number;
  created_at: string;
  updated_at: string;
}

export async function listXCampaigns(): Promise<XCampaign[]> {
  try {
    const { adAccountId } = await getXConfig();
    if (!adAccountId) return [];
    const res = await xFetch(
      `/accounts/${adAccountId}/campaigns?count=20&sort_by=created_at-desc`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

export interface XStats {
  impressions: number;
  clicks: number;
  spend_micro: number;
  engagements: number;
}

export async function getXStats(
  dateStart: string,
  dateEnd: string,
): Promise<XStats> {
  const empty: XStats = { impressions: 0, clicks: 0, spend_micro: 0, engagements: 0 };
  try {
    const { adAccountId } = await getXConfig();
    if (!adAccountId) return empty;
    const res = await xFetch(
      `/stats/accounts/${adAccountId}?granularity=DAY&metric_groups=ENGAGEMENT,BILLING&start_time=${dateStart}T00:00:00Z&end_time=${dateEnd}T23:59:59Z`,
    );
    if (!res.ok) return empty;
    const data = await res.json();
    const metrics = data.data?.id_data?.[0]?.id_data ?? {};
    return {
      impressions: metrics.impressions ?? 0,
      clicks: metrics.clicks ?? 0,
      spend_micro: metrics.billed_charge_local_micro ?? 0,
      engagements: metrics.engagements ?? 0,
    };
  } catch {
    return empty;
  }
}
