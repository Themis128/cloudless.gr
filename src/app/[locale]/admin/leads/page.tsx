"use client";

import React, { useEffect, useState, useCallback } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { InsightPanel } from "@/components/admin/InsightPanel";

const REFRESH_INTERVAL = 30_000;
const TH_CLASS = "px-6 py-3 text-left font-mono text-xs font-medium text-slate-500";
const TD_CLASS = "px-6 py-4 text-sm";

interface UnifiedLead {
  email: string;
  name: string;
  company?: string;
  sources: string[];
  interest?: string;
  status?: string;
  portalStatus?: string;
  createdAt?: string;
}

const SOURCE_BADGE: Record<string, string> = {
  espocrm: "bg-orange-500/10 text-orange-300 border-orange-500/30",
  portal: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
};

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-IE", { dateStyle: "medium", timeZone: "Europe/Athens" });
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<UnifiedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const fetchLeads = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetchWithAuth("/api/admin/leads?limit=100");
      if (!res.ok) {
        if (res.status === 503) throw new Error("No lead source configured");
        throw new Error(`HTTP ${res.status}`);
      }
      const data: { leads: UnifiedLead[]; fetchedAt?: string } = await res.json();
      setLeads(data.leads ?? []);
      setFetchedAt(data.fetchedAt ?? new Date().toISOString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLeads().catch(() => {});
    const interval = setInterval(() => {
      fetchLeads().catch(() => {});
    }, REFRESH_INTERVAL);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchLeads().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchLeads]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? leads.filter(
        (lead) =>
          lead.email.toLowerCase().includes(q) ||
          lead.name.toLowerCase().includes(q) ||
          (lead.company ?? "").toLowerCase().includes(q) ||
          (lead.interest ?? "").toLowerCase().includes(q)
      )
    : leads;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Lead Inbox</h1>
          <p className="mt-1 text-sm text-slate-400">
            Unified view of EspoCRM contacts and portal enrollment requests.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {fetchedAt && (
            <span className="font-mono text-xs text-slate-500">
              Updated{" "}
              {new Date(fetchedAt).toLocaleTimeString(undefined, { timeZone: "Europe/Athens" })}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              fetchLeads(true).catch(() => {});
            }}
            disabled={refreshing}
            className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 font-mono text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20 disabled:opacity-40"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <InsightPanel domain="crm_funnel" />

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, email, company, or interest…"
        className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 font-mono text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500/60"
      />

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-sm text-red-300"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="font-mono text-sm text-slate-500">Loading leads…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/60">
              <tr>
                <th className={TH_CLASS}>Lead</th>
                <th className={TH_CLASS}>Company</th>
                <th className={TH_CLASS}>Interest</th>
                <th className={TH_CLASS}>Sources</th>
                <th className={TH_CLASS}>Status</th>
                <th className={TH_CLASS}>First seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center font-mono text-sm text-slate-500"
                  >
                    {q ? "No leads match your search." : "No leads yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => (
                  <tr key={lead.email} className="transition-colors hover:bg-slate-900/40">
                    <td className={TD_CLASS}>
                      <div className="font-medium text-white">{lead.name || "—"}</div>
                      <div className="font-mono text-xs text-slate-500">{lead.email}</div>
                    </td>
                    <td className={`${TD_CLASS} text-slate-300`}>{lead.company ?? "—"}</td>
                    <td className={`${TD_CLASS} text-slate-300`}>{lead.interest ?? "—"}</td>
                    <td className={TD_CLASS}>
                      <div className="flex flex-wrap gap-1.5">
                        {lead.sources.map((source) => (
                          <span
                            key={source}
                            className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${SOURCE_BADGE[source] ?? "border-slate-600 bg-slate-800 text-slate-300"}`}
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className={`${TD_CLASS} font-mono text-xs text-slate-400`}>
                      {lead.portalStatus ?? lead.status ?? "—"}
                    </td>
                    <td className={`${TD_CLASS} font-mono text-xs text-slate-400`}>
                      {formatDate(lead.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
