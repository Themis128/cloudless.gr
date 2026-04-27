"use client";

import { useEffect, useState, useCallback } from "react";

const REFRESH_INTERVAL = 10_000;

interface Contact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    company?: string;
    createdate?: string;
    hs_lead_status?: string;
  };
}

interface Deal {
  id: string;
  properties: {
    dealname?: string;
    amount?: string;
    dealstage?: string;
    closedate?: string;
    createdate?: string;
  };
}

interface Ticket {
  id: string;
  properties: {
    subject?: string;
    hs_pipeline_stage?: string;
    hs_ticket_priority?: string;
    createdate?: string;
  };
}

interface Stats {
  contacts: {
    total: number;
    newLeads: number;
    qualified: number;
    recent: Contact[];
  };
  deals: {
    total: number;
    pipelineValue: number;
    won: number;
  };
  tickets: {
    total: number;
    open: number;
  };
  fetchedAt: string | null;
}


export default function HubSpotOverviewPage() {
  const [stats, setStats] = useState<Stats>({
    contacts: { total: 0, newLeads: 0, qualified: 0, recent: [] },
    deals: { total: 0, pipelineValue: 0, won: 0 },
    tickets: { total: 0, open: 0 },
    fetchedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [contactsRes, dealsRes, ticketsRes] = await Promise.all([
        fetch("/api/admin/crm/contacts?limit=100"),
        fetch("/api/admin/crm/deals?limit=100"),
        fetch("/api/admin/crm/tickets?limit=100"),
      ]);

      if (!contactsRes.ok && contactsRes.status === 503) {
        throw new Error("HubSpot not configured");
      }

      const [contactsData, dealsData, ticketsData] = await Promise.all([
        contactsRes.ok ? contactsRes.json() : { contacts: [] },
        dealsRes.ok ? dealsRes.json() : { deals: [] },
        ticketsRes.ok ? ticketsRes.json() : { tickets: [] },
      ]);

      const contacts: Contact[] = contactsData.contacts ?? [];
      const deals: Deal[] = dealsData.deals ?? [];
      const tickets: Ticket[] = ticketsData.tickets ?? [];

      const pipelineValue = deals.reduce(
        (sum, d) => sum + (parseFloat(d.properties.amount ?? "0") || 0),
        0,
      );
      const wonDeals = deals.filter(
        (d) => d.properties.dealstage === "closedwon",
      ).length;
      const openTickets = tickets.filter(
        (t) => t.properties.hs_pipeline_stage !== "4",
      ).length;

      setStats({
        contacts: {
          total: contacts.length,
          newLeads: contacts.filter(
            (c) => c.properties.hs_lead_status === "NEW",
          ).length,
          qualified: contacts.filter(
            (c) => c.properties.hs_lead_status === "QUALIFIED",
          ).length,
          recent: contacts
            .slice()
            .sort(
              (a, b) =>
                new Date(b.properties.createdate ?? 0).getTime() -
                new Date(a.properties.createdate ?? 0).getTime(),
            )
            .slice(0, 5),
        },
        deals: {
          total: deals.length,
          pipelineValue,
          won: wonDeals,
        },
        tickets: {
          total: tickets.length,
          open: openTickets,
        },
        fetchedAt: new Date().toISOString(),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll();
    const interval = setInterval(() => void fetchAll(), REFRESH_INTERVAL);
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchAll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchAll]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-magenta font-mono text-xs">HUBSPOT</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">
            HubSpot Overview
          </h1>
          <p className="font-body mt-1 text-slate-400">
            Live snapshot of your CRM — contacts, deals, and support tickets.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            className="border-neon-magenta/30 text-neon-magenta hover:bg-neon-magenta/10 rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          {stats.fetchedAt && (
            <span className="font-mono text-[10px] text-slate-600">
              Updated {new Date(stats.fetchedAt).toLocaleTimeString("en-IE")}
            </span>
          )}
        </div>
      </div>

      {error ? (
        <div className="bg-void-light/50 rounded-xl border border-red-900/30 p-6 text-center">
          <p className="font-mono text-sm text-red-400">{error}</p>
          <p className="mt-2 text-xs text-slate-500">
            {error === "HubSpot not configured"
              ? "Set HUBSPOT_API_KEY in your environment to enable the CRM."
              : "Check your HubSpot API key configuration."}
          </p>
        </div>
      ) : (
        <>
          {/* Contacts stats */}
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-slate-600">
            Contacts
          </p>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total Contacts"
              value={loading ? "…" : stats.contacts.total}
              color="text-white"
            />
            <StatCard
              label="New Leads"
              value={loading ? "…" : stats.contacts.newLeads}
              color="text-neon-cyan"
            />
            <StatCard
              label="Qualified"
              value={loading ? "…" : stats.contacts.qualified}
              color="text-neon-magenta"
            />
          </div>

          {/* Deals stats */}
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-slate-600">
            Deals
          </p>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total Deals"
              value={loading ? "…" : stats.deals.total}
              color="text-white"
            />
            <StatCard
              label="Pipeline Value"
              value={loading ? "…" : fmt(stats.deals.pipelineValue)}
              color="text-neon-green"
            />
            <StatCard
              label="Won"
              value={loading ? "…" : stats.deals.won}
              color="text-neon-cyan"
            />
          </div>

          {/* Tickets stats */}
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-slate-600">
            Support Tickets
          </p>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard
              label="Total Tickets"
              value={loading ? "…" : stats.tickets.total}
              color="text-white"
            />
            <StatCard
              label="Open"
              value={loading ? "…" : stats.tickets.open}
              color="text-yellow-400"
            />
          </div>

          {/* Recent leads */}
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-slate-600">
            Recent Leads
          </p>
          <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
              </div>
            ) : stats.contacts.recent.length === 0 ? (
              <p className="px-6 py-12 text-center font-mono text-slate-600">
                No contacts yet
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                        Added
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.contacts.recent.map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-void-lighter/30 border-b border-slate-800/50 transition-colors"
                      >
                        <td className="px-6 py-4 text-white">
                          {[c.properties.firstname, c.properties.lastname]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </td>
                        <td className="text-neon-cyan px-6 py-4 font-mono text-xs">
                          {c.properties.email ?? "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-neon-cyan/10 px-2 py-0.5 font-mono text-[10px] text-neon-cyan">
                            {c.properties.hs_lead_status ?? "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-500">
                          {c.properties.createdate
                            ? new Date(
                                c.properties.createdate,
                              ).toLocaleDateString("en-IE")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
      <p className="font-mono text-xs text-slate-500">{label}</p>
      <p className={`font-heading mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
