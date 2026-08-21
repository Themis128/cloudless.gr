"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

type Tab = "subscribers" | "contacts";

interface EspoCRMContact {
  id: string;
  emailAddress?: string;
  firstName?: string;
  lastName?: string;
  leadSource?: string;
  createdAt?: string;
}

interface ContactsResponse {
  contacts: EspoCRMContact[];
  total: number;
  fetchedAt: string;
}

const SOURCE_BADGE: Record<string, string> = {
  "Web Site": "border-neon-cyan/30 text-neon-cyan",
  Email: "border-neon-green/30 text-neon-green",
  "Cold Call": "border-yellow-400/30 text-yellow-400",
  Partner: "border-neon-magenta/30 text-neon-magenta",
  "Word of mouth": "border-blue-400/30 text-blue-400",
  Other: "border-slate-700 text-slate-400",
};

export default function EmailPage() {
  const [tab, setTab] = useState<Tab>("subscribers");
  const [data, setData] = useState<ContactsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(t: Tab) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/admin/email/contacts?tab=${t}&limit=100`);
      if (res.status === 503) {
        setNotConfigured(true);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(tab);
  }, [tab]);

  if (notConfigured) {
    return (
      <div>
        <PageHeader />
        <div className="rounded-xl border border-yellow-900/30 bg-yellow-950/10 p-6">
          <p className="font-mono text-sm text-yellow-400">
            EspoCRM is not configured. Add <code className="text-yellow-300">ESPOCRM_API_KEY</code>{" "}
            to AWS SSM.
          </p>
        </div>
      </div>
    );
  }

  const contacts = data?.contacts ?? [];

  return (
    <div>
      <PageHeader />

      {/* Stats bar */}
      {data && (
        <div className="mb-8 inline-flex items-center gap-6 rounded-xl border border-slate-800 bg-slate-900/50 px-6 py-4">
          <div>
            <p className="font-mono text-xs text-slate-500">
              {tab === "subscribers" ? "Newsletter Subscribers" : "CRM Contacts"}
            </p>
            <p className="font-mono text-2xl font-bold text-white">{data.total.toLocaleString()}</p>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <p className="font-mono text-xs text-slate-600">
            via EspoCRM CRM ·{" "}
            {new Date(data.fetchedAt).toLocaleTimeString("en-IE", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Athens",
            })}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-slate-800 bg-slate-900/50 p-1">
        {(
          [
            { id: "subscribers" as Tab, label: "Newsletter Subscribers" },
            { id: "contacts" as Tab, label: "All CRM Contacts" },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-md px-3 py-2 font-mono text-xs transition-all ${
              tab === id ? "bg-neon-cyan/10 text-neon-cyan" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-slate-400">
          <div className="border-neon-cyan h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="font-mono text-sm">Loading…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Email</th>
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Name</th>
                {tab === "contacts" && (
                  <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Source</th>
                )}
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {contacts.length === 0 && (
                <tr>
                  <td
                    colSpan={tab === "contacts" ? 4 : 3}
                    className="py-10 text-center font-mono text-sm text-slate-600"
                  >
                    No contacts found.
                  </td>
                </tr>
              )}
              {contacts.map((c) => {
                const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
                const source = c.leadSource ?? "";
                return (
                  <tr key={c.id} className="transition-colors hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-sm text-white">
                      {c.emailAddress ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-slate-300">{name || "—"}</td>
                    {tab === "contacts" && (
                      <td className="px-4 py-3">
                        {source ? (
                          <span
                            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                              SOURCE_BADGE[source] ?? "border-slate-700 text-slate-500"
                            }`}
                          >
                            {source}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-slate-600">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleDateString("en-IE", {
                            timeZone: "Europe/Athens",
                          })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-white">Email</h1>
        <Link
          href="/admin/email/campaigns"
          className="text-neon-cyan font-mono text-xs hover:underline"
        >
          Campaigns &amp; Audience →
        </Link>
      </div>
      <p className="font-body mt-1 text-slate-400">
        EspoCRM newsletter subscribers and CRM contacts.
      </p>
    </div>
  );
}
