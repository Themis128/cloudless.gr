import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isHubSpotConfigured } from "@/lib/espocrm";
import { getConfig } from "@/lib/ssm-config";

const HUBSPOT_API = "https://api.hubapi.com";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isHubSpotConfigured())) {
    return NextResponse.json({ error: "HubSpot not configured." }, { status: 503 });
  }

  const config = await getConfig();
  const token = config.HUBSPOT_API_KEY;

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") ?? "subscribers";
  const limit = Math.min(
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)),
    MAX_LIMIT,
  );

  try {
    if (tab === "subscribers") {
      // Newsletter subscribers: contacts with lead_source = newsletter_signup
      const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                { propertyName: "lead_source", operator: "EQ", value: "newsletter_signup" },
              ],
            },
          ],
          properties: ["email", "firstname", "lastname", "createdate"],
          sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
          limit,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HubSpot error: ${res.status}`);
      const data = await res.json();
      return NextResponse.json({
        contacts: data.results ?? [],
        total: data.total ?? 0,
        fetchedAt: new Date().toISOString(),
      });
    }

    // All contacts (CRM)
    const res = await fetch(
      `${HUBSPOT_API}/crm/v3/objects/contacts?limit=${limit}&properties=email,firstname,lastname,createdate,lifecyclestage,hs_lead_status,lead_source&archived=false`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) throw new Error(`HubSpot error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json({
      contacts: data.results ?? [],
      total: data.results?.length ?? 0,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[HubSpot] Error fetching email contacts:", err);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 },
    );
  }
}
