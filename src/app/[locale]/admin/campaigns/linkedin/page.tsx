"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import Link from "next/link";

interface LinkedInCampaign {
  id: string;
  name: string;
  status: string;
  type: string;
  objectiveType: string;
  totalBudget: { amount: string; currencyCode: string } | null;
  createdAt: number;
}

interface Insights {
  impressions: number;
  clicks: number;
  costInLocalCurrency: string;
  leads: number;
}

export default function LinkedInPage() {
  const [campaigns, setCampaigns] = useState<LinkedInCampaign[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [camRes, insRes] = await Promise.all([
        fetchWithAuth("/api/admin/campaigns/linkedin"),
        fetchWithAuth("/api/admin/campaigns/linkedin/insights"),
      ]);
      if (camRes.status === 503) { setNotConfigured(true); return; }
      if (!camRes.ok) throw new Error("Failed to load campaigns");
      setCampaigns((await camRes.json()).campaigns ?? []);
      if (insRes.ok) setInsights((await insRes.json()).insights ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  if (notConfigured) {
    return (
      <div>
        <BackLink />
        <div className="rounded-xl border border-yellow-900/30 bg-yellow-950/10 p-6">
          <p className="font-mono text-sm text-yellow-400">
            LinkedIn is not configured. Add <code className="text-yellow-300">LINKEDIN_ACCESS_TOKEN</code> and{" "}
            <code className="text-yellow-300">LINKEDIN_AD_ACCOUNT_ID</code> to AWS SSM.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackLink />
      <div className="mb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
          <span className="font-mono text-xs text-blue-400">LINKEDIN</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">LinkedIn Campaigns</h1>
      </div>

      {insights && (
        <div className="mb-8 grid grid-cols-4 gap-4">
          <MetricCard label="Impressions" value={insights.impressions.toLocaleString()} />
          <MetricCard label="Clicks" value={insights.clicks.toLocaleString()} />
          <MetricCard label="Spend" value={`$${parseFloat(insights.costInLocalCurrency).toFixed(2)}`} />
          <MetricCard label="Leads" value={insights.leads.toLocaleString()} />
        </div>
      )}

      {loading && <Spinner color="border-blue-400" />}
      {error && <ErrorMsg msg={error} />}
      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Campaign</th>
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Status</th>
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Objective</th>
                <th className="px-4 py-3 text-right font-mono text-xs text-slate-500">Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {campaigns.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center font-mono text-sm text-slate-600">No campaigns found.</td></tr>
              )}
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm text-white">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${c.status === "ACTIVE" ? "border-neon-green/30 text-neon-green" : "border-slate-700 text-slate-500"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{c.objectiveType}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">
                    {c.totalBudget ? `${c.totalBudget.amount} ${c.totalBudget.currencyCode}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <div className="mb-6">
      <Link href="/admin/campaigns" className="font-mono text-xs text-slate-500 hover:text-slate-300">
        ← Campaigns
      </Link>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-void-light/50 rounded-xl border border-slate-800 p-3">
      <p className="font-mono text-[10px] text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function Spinner({ color = "border-neon-cyan" }: { color?: string }) {
  return (
    <div className="flex items-center gap-3 text-slate-400">
      <div className={`h-4 w-4 animate-spin rounded-full border-2 ${color} border-t-transparent`} />
      <span className="font-mono text-sm">Loading...</span>
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-sm text-red-400">
      {msg}
    </div>
  );
}
