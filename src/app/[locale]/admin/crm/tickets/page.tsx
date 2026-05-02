"use client";

import React, { useEffect, useState, useCallback } from "react";

const REFRESH_INTERVAL = 10_000;
const TH_CLASS = "px-6 py-3 text-left font-mono text-xs font-medium text-slate-500";

interface Ticket {
  id: string;
  properties: {
    subject?: string;
    content?: string;
    hs_pipeline?: string;
    hs_pipeline_stage?: string;
    hs_ticket_priority?: string;
    createdate?: string;
  };
}

const priorityClasses: Record<string, string> = {
  HIGH: "text-red-400 bg-red-400/10",
  MEDIUM: "text-yellow-400 bg-yellow-400/10",
  LOW: "text-neon-green bg-neon-green/10",
};

const stageLabels: Record<string, string> = {
  "1": "New",
  "2": "Waiting on contact",
  "3": "Waiting on us",
  "4": "Closed",
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const fetchTickets = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/crm/tickets?limit=100");
      if (!res.ok) {
        if (res.status === 503) throw new Error("HubSpot not configured");
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setTickets(data.tickets ?? []);
      setFetchedAt(new Date().toISOString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTickets().catch(() => {});
    const interval = setInterval(() => {
      fetchTickets().catch(() => {});
    }, REFRESH_INTERVAL);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchTickets().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchTickets]);

  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase();
    return (t.properties.subject ?? "").toLowerCase().includes(q);
  });

  const open = tickets.filter(
    (t) => t.properties.hs_pipeline_stage !== "4",
  ).length;

  let mainContent: JSX.Element;
  if (loading) {
    mainContent = (
      <div className="bg-void-light/50 flex items-center justify-center rounded-xl border border-slate-800 py-16">
        <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  } else if (error) {
    mainContent = (
      <div className="bg-void-light/50 rounded-xl border border-red-900/30 p-6 text-center">
        <p className="font-mono text-sm text-red-400">{error}</p>
        <p className="mt-2 text-xs text-slate-500">
          {error === "HubSpot not configured"
            ? "Set HUBSPOT_API_KEY in your environment to enable CRM."
            : "Check your HubSpot API key configuration."}
        </p>
      </div>
    );
  } else {
    mainContent = (
      <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className={TH_CLASS}>Subject</th>
                <th className={TH_CLASS}>Priority</th>
                <th className={TH_CLASS}>Stage</th>
                <th className={TH_CLASS}>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const priority = t.properties.hs_ticket_priority?.toUpperCase() ?? "";
                const stage = t.properties.hs_pipeline_stage ?? "";
                return (
                  <tr
                    key={t.id}
                    className="hover:bg-void-lighter/30 border-b border-slate-800/50 transition-colors"
                  >
                    <td className="max-w-xs px-6 py-4 text-white">
                      <span className="line-clamp-2">{t.properties.subject || "—"}</span>
                    </td>
                    <td className="px-6 py-4">
                      {priority ? (
                        <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${priorityClasses[priority] ?? "text-slate-400 bg-slate-800/50"}`}>
                          {priority}
                        </span>
                      ) : (
                        <span className="font-mono text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${stage === "4" ? "text-neon-green bg-neon-green/10" : "text-yellow-400 bg-yellow-400/10"}`}>
                        {stageLabels[stage] ?? (stage || "—")}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-500">
                      {t.properties.createdate
                        ? new Date(t.properties.createdate).toLocaleDateString("en-IE")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center font-mono text-slate-600">
                    {search ? "No tickets match your search" : "No tickets yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-magenta font-mono text-xs">CRM</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">
            Support Tickets
          </h1>
          <p className="font-body mt-1 text-slate-400">
            Customer support tickets synced from HubSpot.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => fetchTickets(true)}
            disabled={refreshing}
            className="border-neon-magenta/30 text-neon-magenta hover:bg-neon-magenta/10 rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          {fetchedAt && (
            <span className="font-mono text-[10px] text-slate-600">
              Updated {new Date(fetchedAt).toLocaleTimeString("en-IE")}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Total Tickets</p>
          <p className="font-heading mt-1 text-2xl font-bold text-white">
            {loading ? "…" : tickets.length}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Open</p>
          <p className="font-heading mt-1 text-2xl font-bold text-yellow-400">
            {loading ? "…" : open}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Closed</p>
          <p className="font-heading text-neon-green mt-1 text-2xl font-bold">
            {loading ? "…" : tickets.length - open}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-void-light focus:border-neon-magenta/50 w-full max-w-md rounded-lg border border-slate-800 px-4 py-3 font-mono text-sm text-white transition-colors placeholder:text-slate-600 focus:outline-none"
        />
      </div>

      {mainContent}
    </div>
  );
}
