import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isConfiguredAsync } from "@/lib/integrations";
import { listContacts, listLeads } from "@/lib/espocrm";
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
  /** EspoCRM leadSource (for contacts) or lead status (for Lead entities). */
  status?: string;
  /** Portal enrollment status, when present. */
  portalStatus?: string;
  createdAt?: string;
}

// EspoCRM returns flat records — these match the actual API response shapes.
interface EspoCRMContactRecord {
  id: string;
  emailAddress?: string;
  firstName?: string;
  lastName?: string;
  accountName?: string;
  leadSource?: string;
  createdAt?: string;
}

interface EspoCRMLeadRecord {
  id: string;
  emailAddress?: string;
  firstName?: string;
  lastName?: string;
  accountName?: string;
  source?: string;
  status?: string;
  description?: string;
  createdAt?: string;
}

function extractLeadInterest(description?: string): string | undefined {
  if (!description) return undefined;
  const tier = description.match(/^Tier:\s*(.+)$/m)?.[1]?.trim();
  const campaign = description.match(/^Campaign:\s*(.+)$/m)?.[1]?.trim();
  if (tier && campaign) return `${tier} (${campaign})`;
  return tier ?? campaign;
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

    const [contactsResult, leadsResult, pendingResult] = await Promise.allSettled([
      espocrmConfigured ? listContacts(limit) : Promise.resolve([]),
      espocrmConfigured ? listLeads(limit) : Promise.resolve([]),
      readPendingClients(),
    ]);

    const contacts =
      contactsResult.status === "fulfilled" ? (contactsResult.value as EspoCRMContactRecord[]) : [];
    const espoLeads =
      leadsResult.status === "fulfilled" ? (leadsResult.value as EspoCRMLeadRecord[]) : [];
    const pending = pendingResult.status === "fulfilled" ? pendingResult.value : [];

    if (!espocrmConfigured && pending.length === 0) {
      return NextResponse.json(
        { error: "No lead source configured (EspoCRM key missing, no portal leads)." },
        { status: 503 }
      );
    }

    const map = new Map<string, UnifiedLead>();

    for (const contact of contacts) {
      if (!contact.emailAddress) continue;
      mergeLead(map, {
        email: contact.emailAddress,
        name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
        company: contact.accountName || undefined,
        sources: ["espocrm"],
        status: contact.leadSource || undefined,
        createdAt: contact.createdAt || undefined,
      });
    }

    for (const lead of espoLeads) {
      if (!lead.emailAddress) continue;
      mergeLead(map, {
        email: lead.emailAddress,
        name: [lead.firstName, lead.lastName].filter(Boolean).join(" "),
        company: lead.accountName || undefined,
        sources: ["espocrm-lead"],
        interest: extractLeadInterest(lead.description),
        status: lead.status || undefined,
        createdAt: lead.createdAt || undefined,
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
        espocrm_leads: espocrmConfigured,
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
