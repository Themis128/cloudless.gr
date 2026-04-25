import { getConfig } from "@/lib/ssm-config";

const LINKEDIN_API = "https://api.linkedin.com/v2";

async function getLinkedInConfig(): Promise<{
  token: string;
  adAccountId: string;
  orgUrn: string;
}> {
  const cfg = await getConfig();
  const token = cfg.LINKEDIN_ACCESS_TOKEN;
  const adAccountId = cfg.LINKEDIN_AD_ACCOUNT_ID;
  const orgUrn = cfg.LINKEDIN_ORGANIZATION_URN;
  if (!token) throw new Error("LinkedIn not configured");
  return { token, adAccountId, orgUrn };
}

async function liiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const { token } = await getLinkedInConfig();
  return fetch(`${LINKEDIN_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": "202401",
      ...options.headers,
    },
  });
}

export async function isLinkedInConfigured(): Promise<boolean> {
  try {
    await getLinkedInConfig();
    return true;
  } catch {
    return false;
  }
}

export interface LinkedInCampaign {
  id: string;
  name: string;
  status: string;
  type: string;
  objectiveType: string;
  totalBudget: { amount: string; currencyCode: string } | null;
  createdAt: number;
  lastModifiedAt: number;
}

export async function listLinkedInCampaigns(): Promise<LinkedInCampaign[]> {
  try {
    const { adAccountId } = await getLinkedInConfig();
    if (!adAccountId) return [];
    const res = await liiFetch(
      `/adAccounts/${adAccountId}/adCampaigns?q=search&search.status.values[0]=ACTIVE&count=20`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.elements ?? []).map(
      (el: {
        id: number;
        name: string;
        status: string;
        type: string;
        objectiveType: string;
        totalBudget?: { amount: string; currencyCode: string };
        changeAuditStamps: {
          created: { time: number };
          lastModified: { time: number };
        };
      }) => ({
        id: String(el.id),
        name: el.name,
        status: el.status,
        type: el.type,
        objectiveType: el.objectiveType,
        totalBudget: el.totalBudget ?? null,
        createdAt: el.changeAuditStamps?.created?.time ?? 0,
        lastModifiedAt: el.changeAuditStamps?.lastModified?.time ?? 0,
      }),
    );
  } catch {
    return [];
  }
}

export interface LinkedInInsights {
  impressions: number;
  clicks: number;
  costInLocalCurrency: string;
  leads: number;
}

export async function getLinkedInInsights(
  dateStart: string,
  dateEnd: string,
): Promise<LinkedInInsights> {
  const empty: LinkedInInsights = {
    impressions: 0,
    clicks: 0,
    costInLocalCurrency: "0",
    leads: 0,
  };
  try {
    const { adAccountId } = await getLinkedInConfig();
    if (!adAccountId) return empty;
    const res = await liiFetch(
      `/adAnalytics?q=analytics&pivot=ACCOUNT&dateRange.start.day=${dateStart.split("-")[2]}&dateRange.start.month=${dateStart.split("-")[1]}&dateRange.start.year=${dateStart.split("-")[0]}&dateRange.end.day=${dateEnd.split("-")[2]}&dateRange.end.month=${dateEnd.split("-")[1]}&dateRange.end.year=${dateEnd.split("-")[0]}&accounts[0]=urn:li:sponsoredAccount:${adAccountId}&fields=impressions,clicks,costInLocalCurrency,leads`,
    );
    if (!res.ok) return empty;
    const data = await res.json();
    const el = data.elements?.[0] ?? {};
    return {
      impressions: el.impressions ?? 0,
      clicks: el.clicks ?? 0,
      costInLocalCurrency: el.costInLocalCurrency ?? "0",
      leads: el.leads ?? 0,
    };
  } catch {
    return empty;
  }
}
