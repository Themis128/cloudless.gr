"use client";

import { useCallback, useState } from "react";
import { Link } from "@/i18n/navigation";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { contactDisplayName } from "@/lib/crm-contact-360-shared";
import { useVisiblePoll } from "@/lib/use-visible-poll";
import { InsightPanel } from "@/components/admin/InsightPanel";

interface Contact {
  id: string;
  emailAddress?: string;
  firstName?: string;
  lastName?: string;
  accountName?: string;
  createdAt?: string;
  leadSource?: string;
}

const SOURCE_CLASSES: Record<string, string> = {
  "Web Site": "text-neon-cyan bg-neon-cyan/10",
  Email: "text-neon-green bg-neon-green/10",
  "Cold Call": "text-yellow-400 bg-yellow-400/10",
  Partner: "text-neon-magenta bg-neon-magenta/10",
  "Word of mouth": "text-blue-400 bg-blue-400/10",
  Other: "text-slate-400 bg-slate-800/50",
};

const getEmail = (c: Contact) => c.emailAddress ?? "";
const getFirst = (c: Contact) => c.firstName ?? "";
const getLast = (c: Contact) => c.lastName ?? "";
const getCompany = (c: Contact) => c.accountName ?? "";

const isThisWeek = (dateStr?: string) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  return d >= cutoff;
};

export default function AdminCRMPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/crm/contacts?limit=50");
      if (!res.ok) {
        if (res.status === 503) throw new Error("EspoCRM not configured");
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { contacts: Contact[] };
      setContacts(data.contacts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  // Visibility-gated polling — pauses while the tab is hidden to avoid
  // amplifying Cloudflare Worker / API request volume.
  useVisiblePoll(fetchContacts, 10_000);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      getEmail(c).toLowerCase().includes(q) ||
      getFirst(c).toLowerCase().includes(q) ||
      getLast(c).toLowerCase().includes(q) ||
      getCompany(c).toLowerCase().includes(q)
    );
  });

  let content;
  if (loading) {
    content = (
      <div className="bg-void-light/50 flex items-center justify-center rounded-xl border border-slate-800 py-16">
        <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  } else if (error) {
    content = (
      <div className="bg-void-light/50 rounded-xl border border-red-900/30 p-6 text-center">
        <p className="font-mono text-sm text-red-400">{error}</p>
        <p className="mt-2 text-xs text-slate-500">
          {error === "EspoCRM not configured"
            ? "Set ESPOCRM_API_KEY in your environment to enable CRM."
            : "Check your EspoCRM API key configuration."}
        </p>
      </div>
    );
  } else {
    content = (
      <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
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
                  Company
                </th>
                <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                  Source
                </th>
                <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                  Added
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const source = c.leadSource ?? "";
                const created = c.createdAt;
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-void-lighter/30 border-b border-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-white">
                      <Link
                        href={`/admin/crm/${c.id}`}
                        className="hover:text-neon-magenta transition-colors"
                      >
                        {contactDisplayName({
                          firstName: getFirst(c),
                          lastName: getLast(c),
                          email: getEmail(c),
                        })}
                      </Link>
                    </td>
                    <td className="text-neon-cyan px-6 py-4 font-mono text-xs">
                      {getEmail(c) || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{getCompany(c) || "—"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${SOURCE_CLASSES[source] ?? "bg-slate-800/50 text-slate-400"}`}
                      >
                        {source || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-500">
                      {created
                        ? new Date(created).toLocaleDateString("en-IE", {
                            timeZone: "Europe/Athens",
                          })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
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
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">CRM</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">CRM Contacts</h1>
        <p className="font-body mt-1 text-slate-400">Leads and contacts synced from EspoCRM.</p>
      </div>

      <InsightPanel domain="crm_funnel" />

      {/* RFM quick links */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/admin/analytics/explore?dataset=rfm&q=champions"
          className="border-neon-cyan/20 bg-neon-cyan/5 text-neon-cyan/70 hover:bg-neon-cyan/15 rounded-full border px-3 py-1 font-mono text-[10px] transition-colors"
        >
          🏆 RFM Champions →
        </Link>
        <Link
          href="/admin/analytics/explore?dataset=churn&q=high-risk"
          className="rounded-full border border-red-500/20 bg-red-500/5 px-3 py-1 font-mono text-[10px] text-red-400/70 transition-colors hover:bg-red-500/10"
        >
          ⚠ High Churn Risk →
        </Link>
        <Link
          href="/admin/analytics/explore?dataset=espocrm-opps&q=pipeline"
          className="border-neon-magenta/20 bg-neon-magenta/5 text-neon-magenta/70 hover:bg-neon-magenta/15 rounded-full border px-3 py-1 font-mono text-[10px] transition-colors"
        >
          🔀 Open Pipeline →
        </Link>
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
          <p className="font-mono text-xs text-slate-500">New This Week</p>
          <p className="font-heading text-neon-cyan mt-1 text-2xl font-bold">
            {loading ? "…" : contacts.filter((c) => isThisWeek(c.createdAt)).length}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">With Company</p>
          <p className="font-heading text-neon-magenta mt-1 text-2xl font-bold">
            {loading ? "…" : contacts.filter((c) => !!c.accountName).length}
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

      {content}
    </div>
  );
}
