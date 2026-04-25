import { createSign } from "crypto";
import { getConfig } from "@/lib/ssm-config";

const GOOGLE_ADS_API = "https://googleads.googleapis.com/v17";
const ADS_SCOPE = "https://www.googleapis.com/auth/adwords";

// Module-level token cache to avoid minting a new JWT on every request.
let cachedToken: { value: string; expiresAt: number } | null = null;

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getServiceAccountAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value;

  const email = process.env.GOOGLE_CLIENT_EMAIL ?? "";
  const rawKey = process.env.GOOGLE_PRIVATE_KEY ?? "";
  const privateKey = rawKey.replace(/\\n/g, "\n");

  if (!email || !privateKey)
    throw new Error("Google service account env vars missing");

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: email,
      scope: ADS_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = base64url(signer.sign(privateKey));

  const jwt = `${header}.${payload}.${signature}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token)
    throw new Error(`Google token exchange failed: ${data.error}`);

  cachedToken = { value: data.access_token, expiresAt: now + 3600 };
  return data.access_token;
}

async function getGoogleAdsConfig(): Promise<{
  devToken: string;
  customerId: string;
  accessToken: string;
}> {
  const cfg = await getConfig();
  if (!cfg.GOOGLE_ADS_DEVELOPER_TOKEN || !cfg.GOOGLE_ADS_CUSTOMER_ID) {
    throw new Error("Google Ads not configured");
  }
  const accessToken = await getServiceAccountAccessToken();
  return {
    devToken: cfg.GOOGLE_ADS_DEVELOPER_TOKEN,
    customerId: cfg.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, ""),
    accessToken,
  };
}

async function gadsFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
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
    return Boolean(
      cfg.GOOGLE_ADS_DEVELOPER_TOKEN && cfg.GOOGLE_ADS_CUSTOMER_ID,
    );
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
