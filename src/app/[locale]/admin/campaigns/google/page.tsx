"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import { BackLink, MetricCard, Spinner, ErrorMsg } from "@/components/admin/CampaignPageKit";

/**
 * Matches GoogleCampaign returned by GET /api/admin/campaigns/google
 * (src/lib/campaigns/google-ads.ts). Budget is in micros (1e6 = 1 unit).
 */
interface GoogleCampaign {
  id: string;
  name: string;
  status: string;
  advertisingChannelType: string;
  budgetAmountMicros: string;
  startDate: string;
  endDate: string;
}

/** Matches GoogleMetrics returned by GET /api/admin/campaigns/google/insights. */
interface GoogleMetrics {
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  /** Fraction (0.05 = 5%), as reported by the Google Ads API. */
  ctr: number;
}

function microsToUnits(micros: string | number): string {
  const n = typeof micros === "string" ? Number.parseInt(micros, 10) : micros;
  return (Number.isFinite(n) ? n / 1_000_000 : 0).toFixed(2);
}

export default function GoogleCampaignsPage() {
  const [campaigns, setCampaigns] = useState<GoogleCampaign[]>([]);
  const [metrics, setMetrics] = useState<GoogleMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [camRes, insRes] = await Promise.all([
        fetchWithAuth("/api/admin/campaigns/google"),
        fetchWithAuth("/api/admin/campaigns/google/insights"),
      ]);
      if (camRes.status === 503) {
        setNotConfigured(true);
        return;
      }
      if (!camRes.ok) throw new Error("Failed to load campaigns");
      setCampaigns((await camRes.json() as { campaigns: any[] }).campaigns ?? []);
      if (insRes.ok) setMetrics((await insRes.json() as { metrics: any }).metrics ?? null);
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
            Google Ads is not configured. Add{" "}
            <code className="text-yellow-300">GOOGLE_ADS_DEVELOPER_TOKEN</code> and{" "}
            <code className="text-yellow-300">GOOGLE_ADS_CUSTOMER_ID</code> to AWS SSM.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackLink />
      <div className="mb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
          <span className="font-mono text-xs text-red-400">GOOGLE ADS</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Google Ads Campaigns</h1>
      </div>

      {metrics && (
        <div className="mb-8 grid grid-cols-5 gap-4">
          <MetricCard label="Impressions" value={metrics.impressions.toLocaleString()} />
          <MetricCard label="Clicks" value={metrics.clicks.toLocaleString()} />
          <MetricCard label="CTR" value={`${(metrics.ctr * 100).toFixed(2)}%`} />
          <MetricCard label="Spend" value={`$${microsToUnits(metrics.costMicros)}`} />
          <MetricCard label="Conversions" value={metrics.conversions.toLocaleString()} />
        </div>
      )}

      {loading && <Spinner color="border-red-400" />}
      {error && <ErrorMsg msg={error} />}
      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Campaign</th>
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Status</th>
                <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">Channel</th>
                <th className="px-4 py-3 text-right font-mono text-xs text-slate-500">Budget</th>
                <th className="px-4 py-3 text-right font-mono text-xs text-slate-500">Schedule</th>
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
                <tr key={c.id} className="transition-colors hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono text-sm text-white">{c.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {c.advertisingChannelType}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">
                    ${microsToUnits(c.budgetAmountMicros)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">
                    {c.startDate}
                    {c.endDate ? ` → ${c.endDate}` : ""}
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

function StatusBadge({ status }: { readonly status: string }) {
  const color =
    status === "ENABLED"
      ? "text-neon-green border-neon-green/30"
      : status === "PAUSED"
        ? "text-yellow-400 border-yellow-400/30"
        : "text-slate-500 border-slate-600";
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${color}`}>
      {status}
    </span>
  );
}
