"use client";

import { useEffect, useState, useCallback } from "react";

const REFRESH_INTERVAL = 10_000;
const TH_CLASS = "px-6 py-3 text-left font-mono text-xs font-medium text-slate-500";

interface Company {
  id: string;
  properties: {
    name?: string;
    domain?: string;
    city?: string;
    country?: string;
    createdate?: string;
  };
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const fetchCompanies = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/crm/companies?limit=100");
      if (!res.ok) {
        if (res.status === 503) throw new Error("HubSpot not configured");
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setCompanies(data.companies ?? []);
      setFetchedAt(new Date().toISOString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load companies");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCompanies().catch(() => {});
    const interval = setInterval(() => {
      fetchCompanies().catch(() => {});
    }, REFRESH_INTERVAL);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchCompanies().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchCompanies]);

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase();
    const p = c.properties;
    return (
      (p.name ?? "").toLowerCase().includes(q) ||
      (p.domain ?? "").toLowerCase().includes(q) ||
      (p.city ?? "").toLowerCase().includes(q) ||
      (p.country ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-magenta font-mono text-xs">CRM</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">
            Companies
          </h1>
          <p className="font-body mt-1 text-slate-400">
            Company accounts synced from HubSpot.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => fetchCompanies(true)}
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
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Total Companies</p>
          <p className="font-heading mt-1 text-2xl font-bold text-white">
            {loading ? "…" : companies.length}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">With Domain</p>
          <p className="font-heading text-neon-cyan mt-1 text-2xl font-bold">
            {loading
              ? "…"
              : companies.filter((c) => c.properties.domain).length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, domain, or location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-void-light focus:border-neon-magenta/50 w-full max-w-md rounded-lg border border-slate-800 px-4 py-3 font-mono text-sm text-white transition-colors placeholder:text-slate-600 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="bg-void-light/50 flex items-center justify-center rounded-xl border border-slate-800 py-16">
          <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="bg-void-light/50 rounded-xl border border-red-900/30 p-6 text-center">
          <p className="font-mono text-sm text-red-400">{error}</p>
          <p className="mt-2 text-xs text-slate-500">
            {error === "HubSpot not configured"
              ? "Set HUBSPOT_API_KEY in your environment to enable CRM."
              : "Check your HubSpot API key configuration."}
          </p>
        </div>
      ) : (
        <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className={TH_CLASS}>
                    Company
                  </th>
                  <th className={TH_CLASS}>
                    Domain
                  </th>
                  <th className={TH_CLASS}>
                    Location
                  </th>
                  <th className={TH_CLASS}>
                    Added
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-void-lighter/30 border-b border-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-white">
                      {c.properties.name || "—"}
                    </td>
                    <td className="text-neon-cyan px-6 py-4 font-mono text-xs">
                      {c.properties.domain ? (
                        <a
                          href={`https://${c.properties.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {c.properties.domain}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {[c.properties.city, c.properties.country]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-500">
                      {c.properties.createdate
                        ? new Date(c.properties.createdate).toLocaleDateString(
                            "en-IE",
                          )
                        : "—"}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center font-mono text-slate-600"
                    >
                      {search
                        ? "No companies match your search"
                        : "No companies yet"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
