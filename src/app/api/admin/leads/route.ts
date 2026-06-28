import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isConfiguredAsync } from "@/lib/integrations";
import { listContacts } from "@/lib/espocrm";
import { readPendingClients, PLAN_LABELS } from "@/lib/pending-clients";
import { mapIntegrationError } from "@/lib/api-errors";

/**
 * Unified lead inbox — joins EspoCRM contacts with portal enrollment
 * requests (pending clients) into one email-keyed list, newest first.
 *
 * EspoCRM is the primary source; the route still returns portal leads when
 * EspoCRM is unconfigured (and 503 only when no source is available).
 */

export interface UnifiedLead {
  email: string;
  name: string;
  company?: string;
  sources: string[];
  /** Plan/service interest, when known. */
  interest?: string;
  /** EspoCRM hs_lead_status, when present. */
  status?: string;
  /** Portal enrollment status, when present. */
  portalStatus?: string;
  createdAt?: string;
}

interface EspoCRMContactRecord {
  id: string;
  properties?: {
    email?: string;
    firstname?: string;
    lastname?: string;
    company?: string;
    createdate?: string;
    hs_lead_status?: string;
  };
}

function mergeLead(map: Map<string, UnifiedLead>, lead: UnifiedLead): void {
  const key = lead.email.toLowerCase();
  const existing = map.get(key);
  if (!existing) {
    map.set(key, lead);
    return;
  }
  existing.sources = [...new Set([...existing.sources, ...lead.sources])];
  existing.name = existing.name || lead.name;
  existing.company = existing.company ?? lead.company;
  existing.interest = existing.interest ?? lead.interest;
  existing.status = existing.status ?? lead.status;
  existing.portalStatus = existing.portalStatus ?? lead.portalStatus;
  // Keep the earliest creation date (first touch).
  if (lead.createdAt && (!existing.createdAt || lead.createdAt < existing.createdAt)) {
    existing.createdAt = lead.createdAt;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const espocrmConfigured = await isConfiguredAsync("ESPOCRM_API_KEY");

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

    const [contactsResult, pendingResult] = await Promise.allSettled([
      espocrmConfigured ? listContacts(limit) : Promise.resolve([]),
      readPendingClients(),
    ]);

    const contacts =
      contactsResult.status === "fulfilled" ? (contactsResult.value as EspoCRMContactRecord[]) : [];
    const pending = pendingResult.status === "fulfilled" ? pendingResult.value : [];

    if (!espocrmConfigured && pending.length === 0) {
      return NextResponse.json(
        { error: "No lead source configured (EspoCRM key missing, no portal leads)." },
        { status: 503 }
      );
    }

    const map = new Map<string, UnifiedLead>();

    for (const contact of contacts) {
      const p = contact.properties ?? {};
      if (!p.email) continue;
      mergeLead(map, {
        email: p.email,
        name: [p.firstname, p.lastname].filter(Boolean).join(" "),
        company: p.company || undefined,
        sources: ["espocrm"],
        status: p.hs_lead_status || undefined,
        createdAt: p.createdate || undefined,
      });
    }

    for (const client of pending) {
      mergeLead(map, {
        email: client.email,
        name: client.name ?? "",
        sources: ["portal"],
        interest: client.planLabel ?? PLAN_LABELS[client.plan] ?? client.plan,
        portalStatus: client.status,
        createdAt: client.submittedAt,
      });
    }

    const leads = [...map.values()].sort((a, b) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
    );

    return NextResponse.json({
      leads,
      total: leads.length,
      sources: {
        espocrm: espocrmConfigured,
        portal: true,
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[Leads] Error building unified inbox:", err);
    return NextResponse.json({ error: "Failed to fetch leads." }, { status: 500 });
  }
}
