"use client";

import { useEffect, useState } from "react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  cost: number;
}

export default function GoogleCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/google/campaigns")
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  const totalImpressions = campaigns.reduce((s, c) => s + (c.impressions ?? 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + (c.clicks ?? 0), 0);
  const totalCost = campaigns.reduce(
    (s, c) => s + Number.parseFloat(String(c.cost ?? 0)),
    0,
  );
  const avgCtr =
    totalImpressions > 0
      ? ((totalClicks / totalImpressions) * 100).toFixed(2)
      : "0.00";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Impressions" value={totalImpressions.toLocaleString()} />
        <MetricCard label="Clicks" value={totalClicks.toLocaleString()} />
        <MetricCard label="CTR" value={`${avgCtr}%`} />
        <MetricCard label="Spend" value={`$${totalCost.toFixed(2)}`} />
      </div>

      <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
        <div className="border-b border-slate-800 px-6 py-3">
          <h3 className="font-mono text-xs font-medium text-slate-400">
            Google Ads Campaigns
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                  Campaign
                </th>
                <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">
                  Status
                </th>
                <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">
                  Impressions
                </th>
                <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">
                  Clicks
                </th>
                <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-void-lighter/30 border-b border-slate-800/50 transition-colors"
                >
                  <td className="px-6 py-3 text-white">{c.name}</td>
                  <td className="px-6 py-3 text-right font-mono text-xs">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-sm text-white">
                    {(c.impressions ?? 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-sm text-white">
                    {(c.clicks ?? 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-sm text-white">
                    ${Number.parseFloat(String(c.cost ?? 0)).toFixed(2)}
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center font-mono text-slate-600"
                  >
                    No Google Ads campaigns found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { readonly label: string; readonly value: string | number }) {
  return (
    <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
      <p className="font-mono text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { readonly status: string }) {
  const color =
    status === "ENABLED"
      ? "text-neon-green border-neon-green/30"
      : status === "PAUSED"
        ? "text-yellow-400 border-yellow-400/30"
        : "text-slate-500 border-slate-600";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${color}`}
    >
      {status}
    </span>
  );
}