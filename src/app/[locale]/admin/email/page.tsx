"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";

type Tab = "campaigns" | "contacts" | "automations";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  send_amt: string;
  opens: string;
  uniqueopens: string;
  linkclicks: string;
  sdate: string;
}

interface Contact {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  cdate: string;
}

interface Automation {
  id: string;
  name: string;
  status: string;
  entered: string;
  exited: string;
}

interface Stats {
  totalContacts: number;
  totalCampaigns: number;
  totalLists: number;
}

const STATUS_BADGE: Record<string, string> = {
  "0": "border-slate-700 text-slate-500",
  "1": "border-neon-cyan/30 text-neon-cyan",
  "2": "border-slate-600 text-slate-400",
  "5": "border-neon-green/30 text-neon-green",
};

const STATUS_LABEL: Record<string, string> = {
  "0": "Draft",
  "1": "Scheduled",
  "2": "Paused",
  "5": "Sent",
};

export default function EmailPage() {
  const [tab, setTab] = useState<Tab>("campaigns");
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStats() {
    try {
      const res = await fetchWithAuth("/api/admin/email/stats");
      if (res.status === 503) { setNotConfigured(true); return; }
      if (!res.ok) return;
      setStats(await res.json());
    } catch { /* silent */ }
  }

  async function loadTab(t: Tab) {
    setLoading(true);
    setError(null);
    try {
      if (t === "campaigns") {
        const res = await fetchWithAuth("/api/admin/email/campaigns?limit=50");
        if (res.status === 503) { setNotConfigured(true); return; }
        if (!res.ok) throw new Error("Failed to load campaigns");
        const data = await res.json();
        setCampaigns(data.campaigns ?? []);
      } else if (t === "contacts") {
        const res = await fetchWithAuth("/api/admin/email/contacts?limit=50");
        if (!res.ok) throw new Error("Failed to load contacts");
        const data = await res.json();
        setContacts(data.contacts ?? []);
      } else if (t === "automations") {
        const res = await fetchWithAuth("/api/admin/email/automations");
        if (!res.ok) throw new Error("Failed to load automations");
        const data = await res.json();
        setAutomations(data.automations ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStats();
    loadTab(tab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTab(tab);
  }, [tab]);

  if (notConfigured) {
    return (
      <div>
        <PageHeader />
        <div className="rounded-xl border border-yellow-900/30 bg-yellow-950/10 p-6">
          <p className="font-mono text-sm text-yellow-400">
            ActiveCampaign is not configured. Add{" "}
            <code className="text-yellow-300">ACTIVECAMPAIGN_API_URL</code> and{" "}
            <code className="text-yellow-300">ACTIVECAMPAIGN_API_TOKEN</code> to AWS SSM.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader />

      {stats && (
        <div className="mb-8 grid grid-cols-3 gap-4">
          <StatCard label="Contacts" value={stats.totalContacts.toLocaleString()} />
          <StatCard label="Campaigns" value={stats.totalCampaigns.toLocaleString()} />
          <StatCard label="Lists" value={stats.totalLists.toLocaleString()} />
        </div>
      )}

      <div className="mb-6 flex gap-1 rounded-lg border border-slate-800 bg-slate-900/50 p-1">
        {(["campaigns", "contacts", "automations"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-2 font-mono text-xs capitalize transition-all ${
              tab === t
                ? "bg-neon-cyan/10 text-neon-cyan"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-slate-400">
          <div className="border-neon-cyan h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="font-mono text-sm">Loading...</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && tab === "campaigns" && (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Campaign</th>
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Status</th>
                <th className="px-4 py-3 text-right font-mono text-xs text-slate-500">Sent</th>
                <th className="px-4 py-3 text-right font-mono text-xs text-slate-500">Opens</th>
                <th className="px-4 py-3 text-right font-mono text-xs text-slate-500">Clicks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center font-mono text-sm text-slate-600">
                    No campaigns found.
                  </td>
                </tr>
              )}
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-mono text-sm text-white">{c.name}</p>
                    <p className="font-mono text-xs text-slate-500 truncate max-w-xs">{c.subject}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${STATUS_BADGE[c.status] ?? "border-slate-700 text-slate-500"}`}
                    >
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">
                    {parseInt(c.send_amt || "0").toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">
                    {parseInt(c.uniqueopens || "0").toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">
                    {parseInt(c.linkclicks || "0").toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && tab === "contacts" && (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Email</th>
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Name</th>
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center font-mono text-sm text-slate-600">
                    No contacts found.
                  </td>
                </tr>
              )}
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm text-white">{c.email}</td>
                  <td className="px-4 py-3 font-mono text-sm text-slate-300">
                    {[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {c.cdate ? new Date(c.cdate).toLocaleDateString("en-IE") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && tab === "automations" && (
        <div className="space-y-3">
          {automations.length === 0 && (
            <p className="py-8 text-center font-mono text-sm text-slate-600">
              No automations found.
            </p>
          )}
          {automations.map((a) => (
            <div
              key={a.id}
              className="bg-void-light/50 flex items-center justify-between rounded-xl border border-slate-800 px-4 py-3"
            >
              <div>
                <p className="font-mono text-sm text-white">{a.name}</p>
                <p className="mt-0.5 font-mono text-xs text-slate-500">
                  {a.entered} entered · {a.exited} exited
                </p>
              </div>
              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                  a.status === "1"
                    ? "border-neon-green/30 text-neon-green"
                    : "border-slate-700 text-slate-500"
                }`}
              >
                {a.status === "1" ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div className="mb-8">
      <div className="bg-neon-cyan/10 border-neon-cyan/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
        <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
        <span className="text-neon-cyan font-mono text-xs">EMAIL MARKETING</span>
      </div>
      <h1 className="font-heading text-2xl font-bold text-white">Email</h1>
      <p className="font-body mt-1 text-slate-400">
        ActiveCampaign campaigns, contacts, and automations.
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
      <p className="font-mono text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
