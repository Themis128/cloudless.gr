"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import { BackLink, MetricCard, Spinner, ErrorMsg } from "@/components/admin/CampaignPageKit";

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  created_time: string;
}

interface Insights {
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  ctr: number;
}

export default function MetaPage() {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [camRes, insRes] = await Promise.all([
        fetchWithAuth("/api/admin/campaigns/meta"),
        fetchWithAuth("/api/admin/campaigns/meta/insights"),
      ]);
      if (camRes.status === 503) {
        setNotConfigured(true);
        return;
      }
      if (!camRes.ok) throw new Error("Failed to load campaigns");
      setCampaigns(((await camRes.json()) as { campaigns: MetaCampaign[] }).campaigns ?? []);
      if (insRes.ok)
        setInsights(((await insRes.json()) as { insights: Insights }).insights ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  if (notConfigured) {
    return (
      <div>
        <BackLink />
        <div className="rounded-xl border border-yellow-900/30 bg-yellow-950/10 p-6">
          <p className="font-mono text-sm text-yellow-400">
            Meta Ads is not configured. Add{" "}
            <code className="text-yellow-300">META_ACCESS_TOKEN</code> and{" "}
            <code className="text-yellow-300">META_AD_ACCOUNT_ID</code> to AWS SSM.
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
          <span className="font-mono text-xs text-blue-400">META (FACEBOOK / INSTAGRAM)</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Meta Campaigns</h1>
      </div>

      {insights && (
        <div className="mb-8 grid grid-cols-5 gap-4">
          <MetricCard label="Impressions" value={insights.impressions.toLocaleString()} />
          <MetricCard label="Clicks" value={insights.clicks.toLocaleString()} />
          <MetricCard label="Spend" value={`€${insights.spend.toFixed(2)}`} />
          <MetricCard label="Leads" value={insights.leads.toLocaleString()} />
          <MetricCard label="CTR" value={`${insights.ctr.toFixed(2)}%`} />
        </div>
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Campaign</th>
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Status</th>
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Objective</th>
                <th className="px-4 py-3 text-right font-mono text-xs text-slate-500">
                  Daily budget
                </th>
                <th className="px-4 py-3 text-right font-mono text-xs text-slate-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center font-mono text-sm text-slate-600">
                    No Meta campaigns found.
                  </td>
                </tr>
              )}
              {campaigns.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono text-sm text-white">{c.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${c.status === "ACTIVE" ? "border-neon-green/30 text-neon-green" : "border-slate-700 text-slate-500"}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{c.objective}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">
                    {c.daily_budget
                      ? `€${(Number.parseInt(c.daily_budget, 10) / 100).toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">
                    {new Date(c.created_time).toLocaleDateString("en-IE", { dateStyle: "medium" })}
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
