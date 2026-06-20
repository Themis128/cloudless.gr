import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isEspoCRMConfigured, searchContacts, listContacts } from "@/lib/espocrm";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isEspoCRMConfigured())) {
    return NextResponse.json({ error: "EspoCRM not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") ?? "subscribers";
  const limit = Math.min(
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)),
    MAX_LIMIT,
  );

  try {
    if (tab === "subscribers") {
      // Newsletter subscribers: EspoCRM Contacts whose leadSource equals
      // "newsletter_signup" (same string the HubSpot import used, preserved
      // by lib/espocrm.ts upsertContact). searchContacts handles the
      // EspoCRM `where[…]` syntax.
      const data = await searchContacts("leadSource", "newsletter_signup");
      return NextResponse.json({
        contacts: data.results.slice(0, limit),
        total: data.total,
        fetchedAt: new Date().toISOString(),
      });
    }

    // All contacts (CRM) — uses lib/espocrm listContacts wrapper.
    const contacts = await listContacts(limit);
    return NextResponse.json({
      contacts,
      total: contacts.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[EspoCRM] Error fetching email contacts:", err);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 },
    );
  }
}
