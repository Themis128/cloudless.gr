"use client";

import { useEffect, useMemo, useState } from "react";

type Tab = "contacts" | "companies" | "deals" | "owners";

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

interface Company {
  id: string;
  properties: {
    name?: string;
    domain?: string;
    industry?: string;
  };
}

interface Deal {
  id: string;
  properties: {
    dealname?: string;
    amount?: string;
    dealstage?: string;
    pipeline?: string;
  };
}

interface Owner {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

const leadStatusClasses: Record<string, string> = {
  NEW: "text-neon-cyan bg-neon-cyan/10",
  OPEN: "text-neon-green bg-neon-green/10",
  IN_PROGRESS: "text-yellow-400 bg-yellow-400/10",
  QUALIFIED: "text-neon-magenta bg-neon-magenta/10",
  UNQUALIFIED: "text-slate-400 bg-slate-800/50",
};

const tabs: Tab[] = ["contacts", "companies", "deals", "owners"];
const tabLabels: Record<Tab, string> = {
  contacts: "Contacts",
  companies: "Companies",
  deals: "Deals",
  owners: "Owners",
};

export default function AdminCRMPage() {
  const [activeTab, setActiveTab] = useState<Tab>("contacts");
  const [items, setItems] = useState<Array<Contact | Company | Deal | Owner>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      const endpoint =
        activeTab === "owners"
          ? "/api/admin/crm/owners"
          : `/api/admin/crm/${activeTab}?limit=50`;

      try {
        const res = await fetch(endpoint);
        if (!res.ok) {
          if (res.status === 503) throw new Error("HubSpot not configured");
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        setItems(data[activeTab] ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [activeTab]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => {
      if (activeTab === "contacts") {
        const contact = item as Contact;
        const p = contact.properties;
        return [p.email, p.firstname, p.lastname, p.company]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
      }

      if (activeTab === "companies") {
        const company = item as Company;
        const p = company.properties;
        return [p.name, p.domain, p.industry]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
      }

      if (activeTab === "deals") {
        const deal = item as Deal;
        const p = deal.properties;
        return [p.dealname, p.amount, p.dealstage, p.pipeline]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
      }

      const owner = item as Owner;
      return [owner.email, owner.firstName, owner.lastName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q));
    });
  }, [activeTab, items, search]);

  function renderSummary() {
    if (activeTab === "contacts") {
      const total = items.length;
      const newLeads = (items as Contact[]).filter(
        (c) => c.properties.hs_lead_status === "NEW",
      ).length;
      const qualified = (items as Contact[]).filter(
        (c) => c.properties.hs_lead_status === "QUALIFIED",
      ).length;
      return (
        <>
          <SummaryCard label="Total Contacts" value={total} />
          <SummaryCard label="New Leads" value={newLeads} accent="cyan" />
          <SummaryCard label="Qualified" value={qualified} accent="magenta" />
        </>
      );
    }

    if (activeTab === "companies") {
      const total = items.length;
      const withDomain = (items as Company[]).filter(
        (company) => company.properties.domain,
      ).length;
      const industries = new Set(
        (items as Company[])
          .map((company) => company.properties.industry)
          .filter(Boolean),
      ).size;
      return (
        <>
          <SummaryCard label="Total Companies" value={total} />
          <SummaryCard label="With Domain" value={withDomain} accent="cyan" />
          <SummaryCard label="Industries" value={industries} accent="magenta" />
        </>
      );
    }

    if (activeTab === "deals") {
      const total = items.length;
      const amount = (items as Deal[])
        .map((deal) => Number(deal.properties.amount ?? 0))
        .reduce((sum, value) => sum + value, 0);
      const pipelines = new Set(
        (items as Deal[])
          .map((deal) => deal.properties.pipeline)
          .filter(Boolean),
      ).size;
      return (
        <>
          <SummaryCard label="Total Deals" value={total} />
          <SummaryCard label="Total Value" value={amount.toFixed(0)} accent="cyan" />
          <SummaryCard label="Pipelines" value={pipelines} accent="magenta" />
        </>
      );
    }

    const total = items.length;
    return (
      <>
        <SummaryCard label="Total Owners" value={total} />
        <SummaryCard label="Team Members" value={total} accent="cyan" />
        <SummaryCard label="Source" value="HubSpot" accent="magenta" />
      </>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">CRM</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">HubSpot CRM</h1>
        <p className="font-body mt-1 text-slate-400">
          Leads, companies, deals and team owners synced from HubSpot.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === tab
                ? "bg-neon-cyan text-black"
                : "bg-void-light text-slate-400 border border-slate-800"
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">{renderSummary()}</div>

      <div className="mb-4">
        <input
          type="text"
          placeholder={`Search ${tabLabels[activeTab]}...`}
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
              ? "Set HUBSPOT_API_KEY, HUBSPOT_ACCESS_TOKEN, or HUBSPOT_PRIVATE_APP_TOKEN in your environment to enable CRM."
              : "Check your HubSpot API key configuration."}
          </p>
        </div>
      ) : (
        <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {activeTab === "contacts" ? (
                  <tr className="border-b border-slate-800">
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Name</th>
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Email</th>
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Company</th>
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Lead Status</th>
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Added</th>
                  </tr>
                ) : activeTab === "companies" ? (
                  <tr className="border-b border-slate-800">
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Company</th>
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Domain</th>
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Industry</th>
                  </tr>
                ) : activeTab === "deals" ? (
                  <tr className="border-b border-slate-800">
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Deal</th>
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Amount</th>
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Stage</th>
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Pipeline</th>
                  </tr>
                ) : (
                  <tr className="border-b border-slate-800">
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Owner</th>
                    <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Email</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={(item as any).id}
                    className="hover:bg-void-lighter/30 border-b border-slate-800/50 transition-colors"
                  >
                    {activeTab === "contacts" ? (
                      <>
                        <td className="px-6 py-4 text-white">
                          {[ (item as Contact).properties.firstname, (item as Contact).properties.lastname ]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </td>
                        <td className="text-neon-cyan px-6 py-4 font-mono text-xs">
                          {(item as Contact).properties.email || "—"}
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {(item as Contact).properties.company || "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${leadStatusClasses[(item as Contact).properties.hs_lead_status ?? ""] ?? "text-slate-400 bg-slate-800/50"}`}
                          >
                            {(item as Contact).properties.hs_lead_status || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-500">
                          {(item as Contact).properties.createdate
                            ? new Date((item as Contact).properties.createdate).toLocaleDateString("en-IE")
                            : "—"}
                        </td>
                      </>
                    ) : activeTab === "companies" ? (
                      <>
                        <td className="px-6 py-4 text-white">{(item as Company).properties.name || "—"}</td>
                        <td className="px-6 py-4 text-neon-cyan font-mono text-xs">{(item as Company).properties.domain || "—"}</td>
                        <td className="px-6 py-4 text-slate-300">{(item as Company).properties.industry || "—"}</td>
                      </>
                    ) : activeTab === "deals" ? (
                      <>
                        <td className="px-6 py-4 text-white">{(item as Deal).properties.dealname || "—"}</td>
                        <td className="px-6 py-4 text-neon-cyan font-mono text-xs">{(item as Deal).properties.amount || "—"}</td>
                        <td className="px-6 py-4 text-slate-300">{(item as Deal).properties.dealstage || "—"}</td>
                        <td className="px-6 py-4 text-slate-300">{(item as Deal).properties.pipeline || "—"}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-white">{[(item as Owner).firstName, (item as Owner).lastName].filter(Boolean).join(" ") || "—"}</td>
                        <td className="px-6 py-4 text-neon-cyan font-mono text-xs">{(item as Owner).email || "—"}</td>
                      </>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={activeTab === "contacts" ? 5 : activeTab === "deals" ? 4 : 3} className="px-6 py-12 text-center font-mono text-slate-600">
                      {search
                        ? `No ${tabLabels[activeTab]} match your search`
                        : `No ${tabLabels[activeTab].toLowerCase()} yet`}
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

function SummaryCard({
  label,
  value,
  accent = "slate",
}: {
  label: string;
  value: string | number;
  accent?: "slate" | "cyan" | "magenta";
}) {
  const accentClasses = {
    slate: "text-slate-400",
    cyan: "text-neon-cyan",
    magenta: "text-neon-magenta",
  } as const;

  return (
    <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
      <p className="font-mono text-xs text-slate-500">{label}</p>
      <p className={`font-heading mt-1 text-2xl font-bold ${accentClasses[accent]}`}>
        {value}
      </p>
    </div>
  );
}
