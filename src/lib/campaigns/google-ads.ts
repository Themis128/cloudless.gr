import { getConfig } from "@/lib/ssm-config";

const GOOGLE_ADS_API = "https://googleads.googleapis.com/v17";

async function getGoogleAdsConfig(): Promise<{
  devToken: string;
  customerId: string;
  accessToken: string;
}> {
  const cfg = await getConfig();
  if (!cfg.GOOGLE_ADS_DEVELOPER_TOKEN || !cfg.GOOGLE_ADS_CUSTOMER_ID) {
    throw new Error("Google Ads not configured");
  }
  // In Lambda, get access token via service account JWT exchange
  const accessToken = process.env.GOOGLE_ADS_ACCESS_TOKEN ?? "";
  return {
    devToken: cfg.GOOGLE_ADS_DEVELOPER_TOKEN,
    customerId: cfg.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, ""),
    accessToken,
  };
}

async function gadsFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { devToken, customerId, accessToken } = await getGoogleAdsConfig();
  return fetch(`${GOOGLE_ADS_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "developer-token": devToken,
      "login-customer-id": customerId,
      ...options.headers,
    },
  });
}

export async function isGoogleAdsConfigured(): Promise<boolean> {
  try {
    const cfg = await getConfig();
    return Boolean(cfg.GOOGLE_ADS_DEVELOPER_TOKEN && cfg.GOOGLE_ADS_CUSTOMER_ID);
  } catch {
    return false;
  }
}

export interface GoogleCampaign {
  id: string;
  name: string;
  status: string;
  advertisingChannelType: string;
  budgetAmountMicros: string;
  startDate: string;
  endDate: string;
}

export async function listGoogleCampaigns(): Promise<GoogleCampaign[]> {
  try {
    const { customerId } = await getGoogleAdsConfig();
    const query = `
      SELECT campaign.id, campaign.name, campaign.status,
             campaign.advertising_channel_type,
             campaign_budget.amount_micros,
             campaign.start_date, campaign.end_date
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      ORDER BY campaign.id DESC
      LIMIT 20
    `;
    const res = await gadsFetch(`/customers/${customerId}/googleAds:search`, {
      method: "POST",
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map(
      (r: {
        campaign: {
          id: string;
          name: string;
          status: string;
          advertisingChannelType: string;
          startDate: string;
          endDate: string;
        };
        campaignBudget?: { amountMicros: string };
      }) => ({
        id: r.campaign.id,
        name: r.campaign.name,
        status: r.campaign.status,
        advertisingChannelType: r.campaign.advertisingChannelType,
        budgetAmountMicros: r.campaignBudget?.amountMicros ?? "0",
        startDate: r.campaign.startDate,
        endDate: r.campaign.endDate,
      }),
    );
  } catch {
    return [];
  }
}

export interface GoogleMetrics {
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  ctr: number;
}

export async function getGoogleMetrics(
  dateStart: string,
  dateEnd: string,
): Promise<GoogleMetrics> {
  const empty: GoogleMetrics = {
    impressions: 0,
    clicks: 0,
    costMicros: 0,
    conversions: 0,
    ctr: 0,
  };
  try {
    const { customerId } = await getGoogleAdsConfig();
    const query = `
      SELECT metrics.impressions, metrics.clicks,
             metrics.cost_micros, metrics.conversions, metrics.ctr
      FROM customer
      WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
    `;
    const res = await gadsFetch(`/customers/${customerId}/googleAds:search`, {
      method: "POST",
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return empty;
    const data = await res.json();
    const m = data.results?.[0]?.metrics ?? {};
    return {
      impressions: parseInt(m.impressions ?? "0", 10),
      clicks: parseInt(m.clicks ?? "0", 10),
      costMicros: parseInt(m.costMicros ?? "0", 10),
      conversions: parseFloat(m.conversions ?? "0"),
      ctr: parseFloat(m.ctr ?? "0"),
    };
  } catch {
    return empty;
  }
}
