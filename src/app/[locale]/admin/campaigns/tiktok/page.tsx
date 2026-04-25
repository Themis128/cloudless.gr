"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import Link from "next/link";

interface TikTokCampaign {
  campaign_id: string;
  campaign_name: string;
  status: string;
  objective_type: string;
  budget: string;
  budget_mode: string;
}

interface Insights {
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  conversions: string;
}

export default function TikTokPage() {
  const [campaigns, setCampaigns] = useState<TikTokCampaign[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [camRes, insRes] = await Promise.all([
        fetchWithAuth("/api/admin/campaigns/tiktok"),
        fetchWithAuth("/api/admin/campaigns/tiktok/insights"),
      ]);
      if (camRes.status === 503) {
        setNotConfigured(true);
        return;
      }
      if (!camRes.ok) throw new Error("Failed to load campaigns");
      const camData = await camRes.json();
      setCampaigns(camData.campaigns ?? []);
      if (insRes.ok) {
        const insData = await insRes.json();
        setInsights(insData.insights ?? null);
      }
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
      <NotConfiguredBanner
        platform="TikTok"
        keys={["TIKTOK_ACCESS_TOKEN", "TIKTOK_ADVERTISER_ID"]}
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/campaigns"
          className="font-mono text-xs text-slate-500 hover:text-slate-300"
        >
          ← Campaigns
        </Link>
      </div>
      <div className="mb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-pink-500/20 bg-pink-500/10 px-3 py-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-pink-400" />
          <span className="font-mono text-xs text-pink-400">TIKTOK</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">
          TikTok Campaigns
        </h1>
      </div>

      {insights && (
        <div className="mb-8 grid grid-cols-3 gap-4 sm:grid-cols-6">
          <MetricCard
            label="Spend"
            value={`$${parseFloat(insights.spend).toFixed(2)}`}
          />
          <MetricCard
            label="Impressions"
            value={parseInt(insights.impressions).toLocaleString()}
          />
          <MetricCard
            label="Clicks"
            value={parseInt(insights.clicks).toLocaleString()}
          />
          <MetricCard
            label="CTR"
            value={`${parseFloat(insights.ctr).toFixed(2)}%`}
          />
          <MetricCard
            label="CPC"
            value={`$${parseFloat(insights.cpc).toFixed(2)}`}
          />
          <MetricCard
            label="Conversions"
            value={parseInt(insights.conversions).toLocaleString()}
          />
        </div>
      )}

      <CampaignTable loading={loading} error={error}>
        {campaigns.map((c) => (
          <tr
            key={c.campaign_id}
            className="hover:bg-slate-800/30 transition-colors"
          >
            <td className="px-4 py-3 font-mono text-sm text-white">
              {c.campaign_name}
            </td>
            <td className="px-4 py-3">
              <StatusBadge status={c.status} />
            </td>
            <td className="px-4 py-3 font-mono text-xs text-slate-400">
              {c.objective_type}
            </td>
            <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">
              {c.budget ? `$${parseFloat(c.budget).toLocaleString()}` : "—"}
            </td>
          </tr>
        ))}
      </CampaignTable>
    </div>
  );
}

function CampaignTable({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
}) {
  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/50">
            <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">
              Campaign
            </th>
            <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">
              Status
            </th>
            <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">
              Objective
            </th>
            <th className="px-4 py-3 text-right font-mono text-xs text-slate-500">
              Budget
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">{children}</tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = ["CAMPAIGN_STATUS_ENABLE", "ACTIVE", "1"].includes(status);
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
        isActive
          ? "border-neon-green/30 text-neon-green"
          : "border-slate-700 text-slate-500"
      }`}
    >
      {isActive ? "Active" : "Paused"}
    </span>
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

function Spinner() {
  return (
    <div className="flex items-center gap-3 text-slate-400">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" />
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

function NotConfiguredBanner({
  platform,
  keys,
}: {
  platform: string;
  keys: string[];
}) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/campaigns"
          className="font-mono text-xs text-slate-500 hover:text-slate-300"
        >
          ← Campaigns
        </Link>
      </div>
      <div className="rounded-xl border border-yellow-900/30 bg-yellow-950/10 p-6">
        <p className="font-mono text-sm text-yellow-400">
          {platform} is not configured. Add{" "}
          {keys.map((k, i) => (
            <span key={k}>
              <code className="text-yellow-300">{k}</code>
              {i < keys.length - 1 ? " and " : ""}
            </span>
          ))}{" "}
          to AWS SSM.
        </p>
      </div>
    </div>
  );
}
