import { getConfig } from "@/lib/ssm-config";

async function getACConfig(): Promise<{ url: string; token: string }> {
  const cfg = await getConfig();
  const url = cfg.ACTIVECAMPAIGN_API_URL;
  const token = cfg.ACTIVECAMPAIGN_API_TOKEN;
  if (!url || !token) throw new Error("ActiveCampaign not configured");
  return { url: url.replace(/\/$/, ""), token };
}

async function acFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const { url, token } = await getACConfig();
  return fetch(`${url}/api/3${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Api-Token": token,
      ...options.headers,
    },
  });
}

export async function isActiveCampaignConfigured(): Promise<boolean> {
  try {
    await getACConfig();
    return true;
  } catch {
    return false;
  }
}

export type ACTokenStatus = "valid" | "rejected" | "not_configured" | "error";

/**
 * Pings the ActiveCampaign API with the configured token.
 * Returns a fine-grained status so the admin integrations health check can
 * distinguish an expired/revoked token from a missing one.
 */
export async function verifyActiveCampaignToken(): Promise<{
  status: ACTokenStatus;
  message?: string;
}> {
  let url: string;
  let token: string;
  try {
    const cfg = await getACConfig();
    url = cfg.url;
    token = cfg.token;
  } catch {
    return { status: "not_configured" };
  }
  try {
    const res = await fetch(`${url}/api/3/contacts?limit=1`, {
      headers: { "Api-Token": token },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401 || res.status === 403) {
      return {
        status: "rejected",
        message: `Token rejected (${res.status}) — account may be expired or token rotated.`,
      };
    }
    if (!res.ok)
      return { status: "error", message: `API returned ${res.status}` };
    return { status: "valid" };
  } catch {
    return { status: "error", message: "Connection failed." };
  }
}

// ── Campaigns ────────────────────────────────────────────────────────────────

export interface ACCampaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  send_amt: string;
  opens: string;
  uniqueopens: string;
  linkclicks: string;
  sdate: string;
  cdate: string;
}

export async function listCampaigns(limit = 20): Promise<ACCampaign[]> {
  try {
    const res = await acFetch(`/campaigns?limit=${limit}&orders[sdate]=DESC`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.campaigns ?? [];
  } catch {
    return [];
  }
}

export async function getCampaign(id: string): Promise<ACCampaign | null> {
  try {
    const res = await acFetch(`/campaigns/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.campaign ?? null;
  } catch {
    return null;
  }
}

export interface CreateCampaignInput {
  name: string;
  subject: string;
  fromname: string;
  fromemail: string;
  listId: string;
  htmlcontent?: string;
  textcontent?: string;
  sdate?: string;
}

export async function createCampaign(
  input: CreateCampaignInput,
): Promise<ACCampaign | null> {
  try {
    const res = await acFetch("/campaigns", {
      method: "POST",
      body: JSON.stringify({
        campaign: {
          type: "single",
          name: input.name,
          subject: input.subject,
          fromname: input.fromname,
          fromemail: input.fromemail,
          status: input.sdate ? "1" : "0",
          htmlcontent: input.htmlcontent ?? "",
          textcontent: input.textcontent ?? "",
          sdate: input.sdate ?? "",
          lists: [{ id: input.listId }],
        },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.campaign ?? null;
  } catch {
    return null;
  }
}

// ── Contacts ─────────────────────────────────────────────────────────────────

export interface ACContact {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  cdate: string;
  udate: string;
}

export async function listACContacts(limit = 20): Promise<ACContact[]> {
  try {
    const res = await acFetch(`/contacts?limit=${limit}&orders[cdate]=DESC`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.contacts ?? [];
  } catch {
    return [];
  }
}

// ── Lists ─────────────────────────────────────────────────────────────────────

export interface ACList {
  id: string;
  name: string;
  subscriber_count: string;
}

export async function listACLists(): Promise<ACList[]> {
  try {
    const res = await acFetch("/lists?limit=100");
    if (!res.ok) return [];
    const data = await res.json();
    return data.lists ?? [];
  } catch {
    return [];
  }
}

// ── Automations ───────────────────────────────────────────────────────────────

export interface ACAutomation {
  id: string;
  name: string;
  status: string;
  entered: string;
  exited: string;
}

export async function listAutomations(): Promise<ACAutomation[]> {
  try {
    const res = await acFetch("/automations?limit=50");
    if (!res.ok) return [];
    const data = await res.json();
    return data.automations ?? [];
  } catch {
    return [];
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getEmailStats(): Promise<{
  totalContacts: number;
  totalCampaigns: number;
  totalLists: number;
}> {
  try {
    const [contactsRes, campaignsRes, listsRes] = await Promise.all([
      acFetch("/contacts?limit=1"),
      acFetch("/campaigns?limit=1"),
      acFetch("/lists?limit=1"),
    ]);
    const [contactsData, campaignsData, listsData] = await Promise.all([
      contactsRes.ok ? contactsRes.json() : { meta: { total: 0 } },
      campaignsRes.ok ? campaignsRes.json() : { meta: { total: 0 } },
      listsRes.ok ? listsRes.json() : { meta: { total: 0 } },
    ]);
    return {
      totalContacts: parseInt(contactsData.meta?.total ?? "0", 10),
      totalCampaigns: parseInt(campaignsData.meta?.total ?? "0", 10),
      totalLists: parseInt(listsData.meta?.total ?? "0", 10),
    };
  } catch {
    return { totalContacts: 0, totalCampaigns: 0, totalLists: 0 };
  }
}
