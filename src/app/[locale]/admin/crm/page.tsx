"use client";

import { useEffect, useState } from "react";

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

const leadStatusClasses: Record<string, string> = {
  NEW: "text-neon-cyan bg-neon-cyan/10",
  OPEN: "text-neon-green bg-neon-green/10",
  IN_PROGRESS: "text-yellow-400 bg-yellow-400/10",
  QUALIFIED: "text-neon-magenta bg-neon-magenta/10",
  UNQUALIFIED: "text-slate-400 bg-slate-800/50",
};

export default function AdminCRMPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchContacts() {
      try {
        const res = await fetch("/api/admin/crm/contacts?limit=50");
        if (!res.ok) {
          if (res.status === 503) throw new Error("HubSpot not configured");
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setContacts(data.contacts ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load contacts");
      } finally {
        setLoading(false);
      }
    }
    fetchContacts();
  }, []);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const p = c.properties;
    return (
      (p.email ?? "").toLowerCase().includes(q) ||
      (p.firstname ?? "").toLowerCase().includes(q) ||
      (p.lastname ?? "").toLowerCase().includes(q) ||
      (p.company ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">CRM</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">CRM Contacts</h1>
        <p className="font-body mt-1 text-slate-400">
          Leads and contacts synced from HubSpot.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Total Contacts</p>
          <p className="font-heading mt-1 text-2xl font-bold text-white">
            {loading ? "…" : contacts.length}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">New Leads</p>
          <p className="font-heading text-neon-cyan mt-1 text-2xl font-bold">
            {loading
              ? "…"
              : contacts.filter((c) => c.properties.hs_lead_status === "NEW").length}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Qualified</p>
          <p className="font-heading text-neon-magenta mt-1 text-2xl font-bold">
            {loading
              ? "…"
              : contacts.filter((c) => c.properties.hs_lead_status === "QUALIFIED").length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email, or company…"
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
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Name</th>
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Email</th>
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Company</th>
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Lead Status</th>
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Added</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-void-lighter/30 border-b border-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-white">
                      {[c.properties.firstname, c.properties.lastname].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="text-neon-cyan px-6 py-4 font-mono text-xs">{c.properties.email ?? "—"}</td>
                    <td className="px-6 py-4 text-slate-300">{c.properties.company || "—"}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${leadStatusClasses[c.properties.hs_lead_status ?? ""] ?? "text-slate-400 bg-slate-800/50"}`}>
                        {c.properties.hs_lead_status ?? "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-500">
                      {c.properties.createdate
                        ? new Date(c.properties.createdate).toLocaleDateString("en-IE")
                        : "—"}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center font-mono text-slate-600">
                      {search ? "No contacts match your search" : "No contacts yet"}
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
