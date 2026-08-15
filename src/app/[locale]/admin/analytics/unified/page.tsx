"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { AdminDailyBars } from "@/components/admin/AdminDailyBars";
import { InsightPanel } from "@/components/admin/InsightPanel";

interface SeoData {
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

interface PipelineData {
  totalDeals: number;
  totalValue: number;
  byStage: Record<string, { count: number; value: number }>;
}

interface EmailData {
  totalContacts: number;
  totalCampaigns: number;
  avgOpenRate?: number;
  avgClickRate?: number;
}

interface StripeDailyPoint {
  day: string;
  revenueMinor: number;
  events: number;
  processed: number;
  failed: number;
}

interface StripeData {
  totalOrders: number;
  revenue: number;
  activeSubscriptions: number | null;
  mrr: number | null;
  dailyTrend?: StripeDailyPoint[];
  dailyTrendSource?: string;
}

interface UnifiedData {
  seo: SeoData | null;
  pipeline: PipelineData | null;
  email: EmailData | null;
  stripe: StripeData | null;
  fetchedAt: string;
}

function KpiCard({
  label,
  value,
  sub,
  color,
}: Readonly<{
  label: string;
  value: string;
  sub?: string;
  color: string;
}>) {
  return (
    <div className="bg-void-light/50 rounded-xl border border-slate-800 p-5">
      <div className={`font-mono text-2xl font-bold ${color}`}>{value}</div>
      <div className="font-heading mt-1 text-sm font-medium text-white">{label}</div>
      {sub && <div className="mt-0.5 font-mono text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function SectionHeader({
  title,
  icon,
  href,
}: Readonly<{
  title: string;
  icon: string;
  href: string;
}>) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-heading text-sm font-semibold tracking-widest text-slate-500 uppercase">
        {icon} {title}
      </h2>
      <Link href={href} className="font-mono text-xs text-slate-500 transition hover:text-white">
        View full →
      </Link>
    </div>
  );
}

function EmptyState({ label }: Readonly<{ label: string }>) {
  return (
    <div className="bg-void-light/30 rounded-xl border border-slate-800 px-5 py-6 font-mono text-xs text-slate-600">
      {label} not configured
    </div>
  );
}

interface RoiChannelData {
  channel: string;
  configured: boolean;
  inGold?: boolean;
  status?: string;
  reason?: string;
  spendCents: number;
  impressions: number;
  clicks: number;
  platformLeads: number;
}

interface RoiData {
  windowDays: number;
  channels: RoiChannelData[];
  notes?: string[];
  totals: {
    spendCents: number;
    impressions: number;
    clicks: number;
    platformLeads: number;
    newLeads: number | null;
    revenueCents: number | null;
    costPerLeadCents: number | null;
    roas: number | null;
  };
}

const CHANNEL_LABELS: Record<string, string> = {
  google: "Google Ads",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  x: "X",
  meta: "Meta",
};

function eurosMajor(amount: number): string {
  return `€${amount.toLocaleString("en-IE", { maximumFractionDigits: 2 })}`;
}

function euros(cents: number | null): string {
  if (cents === null) return "—";
  return eurosMajor(cents / 100);
}

function RoiSection({ roi }: Readonly<{ roi: RoiData | null }>) {
  if (!roi) return <EmptyState label="ROI" />;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Ad spend"
          value={euros(roi.totals.spendCents)}
          sub={`last ${roi.windowDays} days`}
          color="text-neon-magenta"
        />
        <KpiCard
          label="New leads"
          value={roi.totals.newLeads === null ? "—" : String(roi.totals.newLeads)}
          sub={roi.totals.newLeads === null ? "not in gold ROI" : "EspoCRM contacts"}
          color="text-neon-cyan"
        />
        <KpiCard
          label="Cost / lead"
          value={euros(roi.totals.costPerLeadCents)}
          sub={roi.totals.costPerLeadCents === null ? "needs spend + leads" : "blended"}
          color="text-yellow-400"
        />
        <KpiCard
          label="ROAS"
          value={roi.totals.roas === null ? "—" : `${roi.totals.roas}×`}
          sub={euros(roi.totals.revenueCents) + " revenue"}
          color="text-neon-green"
        />
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="px-4 py-2 text-left font-mono text-xs text-slate-500">Channel</th>
              <th className="px-4 py-2 text-left font-mono text-xs text-slate-500">Status</th>
              <th className="px-4 py-2 text-right font-mono text-xs text-slate-500">Spend</th>
              <th className="px-4 py-2 text-right font-mono text-xs text-slate-500">Impressions</th>
              <th className="px-4 py-2 text-right font-mono text-xs text-slate-500">Clicks</th>
              <th className="px-4 py-2 text-right font-mono text-xs text-slate-500">
                Platform leads
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {roi.channels.map((c) => (
              <tr key={c.channel}>
                <td className="px-4 py-2 font-mono text-xs text-white">
                  {CHANNEL_LABELS[c.channel] ?? c.channel}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-slate-400">
                  {c.configured
                    ? "gold"
                    : c.status === "not_in_gold"
                      ? "not in gold"
                      : c.status === "empty_gold"
                        ? "empty gold"
                        : "—"}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs text-slate-300">
                  {c.configured ? euros(c.spendCents) : "—"}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs text-slate-400">
                  {c.configured ? c.impressions.toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs text-slate-400">
                  {c.configured ? c.clicks.toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs text-slate-400">
                  {c.configured ? c.platformLeads.toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {roi.notes && roi.notes.length > 0 ? (
        <ul className="mt-2 space-y-1 font-mono text-[10px] text-slate-600">
          {roi.notes.map((n) => (
            <li key={n}>• {n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function UnifiedAnalyticsPage() {
  const [data, setData] = useState<UnifiedData | null>(null);
  const [roi, setRoi] = useState<RoiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [res, roiRes] = await Promise.all([
          fetchWithAuth("/api/admin/analytics/unified"),
          fetchWithAuth("/api/admin/analytics/roi"),
        ]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: UnifiedData = await res.json();
        if (!cancelled) setData(json);
        if (roiRes.ok) {
          const roiJson: RoiData = await roiRes.json();
          if (!cancelled) setRoi(roiJson);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="bg-neon-green/10 border-neon-green/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-green h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-green font-mono text-xs">UNIFIED ANALYTICS</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">Unified Dashboard</h1>
          <p className="font-body mt-1 text-slate-400">
            All KPIs in one view — SEO, revenue, pipeline, and email.
          </p>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="rounded-lg border border-slate-700 px-4 py-2 font-mono text-xs text-slate-300 transition-all hover:border-slate-600 hover:text-white disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <Link
            href="/admin/reports"
            className="border-neon-green/30 bg-neon-green/10 text-neon-green hover:bg-neon-green/20 rounded-lg border px-4 py-2 font-mono text-xs transition-all"
          >
            ↓ PDF Reports
          </Link>
        </div>
      </div>

      <InsightPanel domain="executive" />

      {error && (
        <div className="mb-6 rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-xs text-red-400">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="space-y-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-void-light/30 h-28 animate-pulse rounded-xl border border-slate-800"
            />
          ))}
        </div>
      )}

      {data && (
        <div className="space-y-10">
          {/* Growth Funnel — GSC clicks → leads → revenue */}
          {(data.seo || data.pipeline || data.stripe) && (
            <div>
              <SectionHeader title="Growth Funnel" icon="📊" href="/admin/analytics/funnel" />
              <div className="flex items-stretch gap-0 overflow-x-auto rounded-xl border border-slate-800">
                {[
                  {
                    label: "Impressions",
                    value: data.seo ? data.seo.impressions.toLocaleString() : "—",
                    sub: "GSC (28d)",
                    color: "text-slate-400",
                    bg: "bg-void-light/30",
                  },
                  {
                    label: "Clicks",
                    value: data.seo ? data.seo.clicks.toLocaleString() : "—",
                    sub: `CTR ${data.seo ? data.seo.ctr.toFixed(1) + "%" : "—"}`,
                    color: "text-neon-blue",
                    bg: "bg-void-light/40",
                  },
                  {
                    label: "Open Deals",
                    value: data.pipeline ? String(data.pipeline.totalDeals) : "—",
                    sub: "EspoCRM pipeline",
                    color: "text-neon-magenta",
                    bg: "bg-void-light/50",
                  },
                  {
                    label: "Pipeline Value",
                    value: data.pipeline
                      ? `€${data.pipeline.totalValue.toLocaleString("en", { maximumFractionDigits: 0 })}`
                      : "—",
                    sub: "open opportunities",
                    color: "text-neon-magenta",
                    bg: "bg-void-light/60",
                  },
                  {
                    label: "Revenue",
                    value: data.stripe ? eurosMajor(data.stripe.revenue) : "—",
                    sub: `${data.stripe ? data.stripe.totalOrders : "—"} orders`,
                    color: "text-neon-green",
                    bg: "bg-void-light/70",
                  },
                ].map((step, i, arr) => (
                  <div
                    key={step.label}
                    className={`${step.bg} relative flex min-w-32 flex-1 flex-col justify-center px-5 py-5`}
                  >
                    {i > 0 && (
                      <span className="absolute top-1/2 -left-2 z-10 -translate-y-1/2 font-mono text-xs text-slate-600">
                        →
                      </span>
                    )}
                    <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
                      {step.label}
                    </p>
                    <p className={`font-heading mt-1 text-xl font-bold ${step.color}`}>
                      {step.value}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-600">{step.sub}</p>
                    {i < arr.length - 1 && (
                      <div className="absolute top-0 right-0 h-full w-px bg-slate-800" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ROI — spend → leads → revenue */}
          <div>
            <SectionHeader title="Campaign ROI" icon="🎯" href="/admin/campaigns" />
            <RoiSection roi={roi} />
          </div>

          {/* Revenue */}
          <div>
            <SectionHeader title="Revenue" icon="💳" href="/admin/orders" />
            {data.stripe ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <KpiCard
                    label="Total Revenue"
                    value={eurosMajor(data.stripe.revenue)}
                    color="text-neon-green"
                  />
                  <KpiCard
                    label="Total Orders"
                    value={String(data.stripe.totalOrders)}
                    color="text-neon-green"
                  />
                  <KpiCard
                    label="Active Subscriptions"
                    value={
                      data.stripe.activeSubscriptions == null
                        ? "—"
                        : String(data.stripe.activeSubscriptions)
                    }
                    color="text-neon-blue"
                  />
                  <KpiCard
                    label="MRR"
                    value={data.stripe.mrr == null ? "—" : eurosMajor(data.stripe.mrr)}
                    sub="monthly recurring"
                    color="text-neon-blue"
                  />
                </div>
                <AdminDailyBars
                  title="Daily revenue"
                  unitLabel="EUR · D1 stripe_transaction"
                  points={(data.stripe.dailyTrend ?? []).map((d) => ({
                    day: d.day,
                    value: d.revenueMinor / 100,
                  }))}
                  formatValue={eurosMajor}
                />
              </div>
            ) : (
              <EmptyState label="Stripe" />
            )}
          </div>

          {/* SEO */}
          <div>
            <SectionHeader title="Search Performance" icon="🔍" href="/admin/analytics" />
            {data.seo ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard
                  label="Clicks"
                  value={data.seo.clicks.toLocaleString()}
                  color="text-neon-green"
                />
                <KpiCard
                  label="Impressions"
                  value={data.seo.impressions.toLocaleString()}
                  color="text-slate-300"
                />
                <KpiCard
                  label="Avg CTR"
                  value={`${data.seo.ctr.toFixed(1)}%`}
                  color="text-neon-blue"
                />
                <KpiCard
                  label="Avg Position"
                  value={(data.seo.avgPosition ?? 0).toFixed(1)}
                  sub="lower is better"
                  color="text-neon-yellow"
                />
              </div>
            ) : (
              <EmptyState label="Google Search Console" />
            )}
          </div>

          {/* Pipeline */}
          <div>
            <SectionHeader title="Sales Pipeline" icon="🔀" href="/admin/pipeline" />
            {data.pipeline ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <KpiCard
                  label="Open Deals"
                  value={String(data.pipeline.totalDeals)}
                  color="text-neon-magenta"
                />
                <KpiCard
                  label="Pipeline Value"
                  value={`€${data.pipeline.totalValue.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                  color="text-neon-magenta"
                />
                <div className="bg-void-light/50 rounded-xl border border-slate-800 p-5">
                  <div className="font-heading mb-2 text-xs font-semibold tracking-widest text-slate-500 uppercase">
                    By lead source
                  </div>
                  <div className="space-y-1">
                    {Object.entries(data.pipeline.byStage).map(([stage, { count }]) => (
                      <div key={stage} className="flex justify-between font-mono text-xs">
                        <span className="truncate text-slate-400">{stage}</span>
                        <span className="text-neon-magenta ml-2 shrink-0">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState label="EspoCRM pipeline" />
            )}
          </div>

          {/* Email */}
          <div>
            <SectionHeader title="Email Marketing" icon="📧" href="/admin/email" />
            {data.email ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard
                  label="Total Contacts"
                  value={data.email.totalContacts.toLocaleString()}
                  color="text-neon-green"
                />
                <KpiCard
                  label="Campaigns"
                  value={String(data.email.totalCampaigns)}
                  color="text-slate-300"
                />
                {data.email.avgOpenRate != null && (
                  <KpiCard
                    label="Avg Open Rate"
                    value={`${data.email.avgOpenRate.toFixed(1)}%`}
                    color="text-neon-blue"
                  />
                )}
                {data.email.avgClickRate != null && (
                  <KpiCard
                    label="Avg Click Rate"
                    value={`${data.email.avgClickRate.toFixed(1)}%`}
                    color="text-neon-blue"
                  />
                )}
              </div>
            ) : (
              <EmptyState label="EspoCRM email" />
            )}
          </div>
        </div>
      )}

      {data?.fetchedAt && (
        <p className="mt-10 font-mono text-xs text-slate-600">
          Last fetched:{" "}
          {new Date(data.fetchedAt).toLocaleTimeString("en-IE", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZone: "Europe/Athens",
          })}
        </p>
      )}
    </div>
  );
}
