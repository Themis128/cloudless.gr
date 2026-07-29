import { getConfig } from "@/lib/ssm-config";

const LINKEDIN_API = "https://api.linkedin.com/rest";

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

async function liiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { token } = await getLinkedInConfig();
  return fetch(`${LINKEDIN_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": "202506",
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
    const res = await liiFetch(`/adAccounts/${adAccountId}/adCampaigns?q=search&count=20`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      elements?: Array<{
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
      }>;
    };
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
      })
    );
  } catch {
    return [];
  }
}

export interface LinkedInInsights {
  impressions: number;
  clicks: number;
  costInLocalCurrency: string;
  conversions: number;
}

export async function getLinkedInInsights(
  dateStart: string,
  dateEnd: string
): Promise<LinkedInInsights> {
  const empty: LinkedInInsights = {
    impressions: 0,
    clicks: 0,
    costInLocalCurrency: "0",
    conversions: 0,
  };
  try {
    const { adAccountId } = await getLinkedInConfig();
    if (!adAccountId) return empty;
    const res = await liiFetch(
      `/adAnalytics?q=analytics&pivot=ACCOUNT&dateRange.start.year=${dateStart.split("-")[0]}&dateRange.start.month=${Number(dateStart.split("-")[1])}&dateRange.start.day=${Number(dateStart.split("-")[2])}&dateRange.end.year=${dateEnd.split("-")[0]}&dateRange.end.month=${Number(dateEnd.split("-")[1])}&dateRange.end.day=${Number(dateEnd.split("-")[2])}&timeGranularity=ALL&accounts%5B0%5D=urn%3Ali%3AsponsoredAccount%3A${adAccountId}&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions`
    );
    if (!res.ok) return empty;
    const data = (await res.json()) as {
      elements?: Array<{
        impressions?: number;
        clicks?: number;
        costInLocalCurrency?: string;
        externalWebsiteConversions?: number;
      }>;
    };
    const el = data.elements?.[0] ?? {};
    return {
      impressions: el.impressions ?? 0,
      clicks: el.clicks ?? 0,
      costInLocalCurrency: el.costInLocalCurrency ?? "0",
      conversions: el.externalWebsiteConversions ?? 0,
    };
  } catch {
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Campaign control (pause / resume / budget)
// ---------------------------------------------------------------------------

export async function pauseLinkedInCampaign(
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { adAccountId } = await getLinkedInConfig();
    const res = await liiFetch(`/adAccounts/${adAccountId}/adCampaigns/${campaignId}`, {
      method: "POST",
      headers: { "X-Restli-Method": "PARTIAL_UPDATE" },
      body: JSON.stringify({ patch: { $set: { status: "PAUSED" } } }),
    });
    if (res.ok || res.status === 204) return { ok: true };
    const text = await res.text().catch(() => "");
    return { ok: false, error: `${res.status}: ${text.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function resumeLinkedInCampaign(
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { adAccountId } = await getLinkedInConfig();
    const res = await liiFetch(`/adAccounts/${adAccountId}/adCampaigns/${campaignId}`, {
      method: "POST",
      headers: { "X-Restli-Method": "PARTIAL_UPDATE" },
      body: JSON.stringify({ patch: { $set: { status: "ACTIVE" } } }),
    });
    if (res.ok || res.status === 204) return { ok: true };
    const text = await res.text().catch(() => "");
    return { ok: false, error: `${res.status}: ${text.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function setLinkedInCampaignBudget(
  campaignId: string,
  dailyBudgetEur: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { adAccountId } = await getLinkedInConfig();
    const res = await liiFetch(`/adAccounts/${adAccountId}/adCampaigns/${campaignId}`, {
      method: "POST",
      headers: { "X-Restli-Method": "PARTIAL_UPDATE" },
      body: JSON.stringify({
        patch: {
          $set: {
            dailyBudget: { amount: String(Math.round(dailyBudgetEur * 100)), currencyCode: "EUR" },
          },
        },
      }),
    });
    if (res.ok || res.status === 204) return { ok: true };
    const text = await res.text().catch(() => "");
    return { ok: false, error: `${res.status}: ${text.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function getLinkedInCampaignStatus(campaignId: string): Promise<{
  ok: boolean;
  name?: string;
  status?: string;
  dailyBudget?: string;
  error?: string;
}> {
  try {
    const { adAccountId } = await getLinkedInConfig();
    const res = await liiFetch(`/adAccounts/${adAccountId}/adCampaigns/${campaignId}`);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      name?: string;
      status?: string;
      dailyBudget?: { amount: string };
    };
    return {
      ok: true,
      name: data.name,
      status: data.status,
      dailyBudget: data.dailyBudget
        ? `€${(Number(data.dailyBudget.amount) / 100).toFixed(2)}`
        : "not set",
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
