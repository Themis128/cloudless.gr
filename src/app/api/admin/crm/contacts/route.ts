import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/integrations";
import { listContacts } from "@/lib/hubspot";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;
  if (!isConfigured("HUBSPOT_API_KEY")) {
    return NextResponse.json({ error: "HubSpot not configured." }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

    const contacts = await listContacts(limit);

    return NextResponse.json({
      contacts,
      total: contacts.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[HubSpot] Error listing contacts:", err);
    return NextResponse.json({ error: "Failed to fetch contacts." }, { status: 500 });
  }
}
