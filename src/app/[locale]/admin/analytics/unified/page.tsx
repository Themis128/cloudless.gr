"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import Link from "next/link";

interface SeoData {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface PipelineData {
  totalDeals: number;
  totalValue: number;
  dealsByStage: Record<string, number>;
}

interface EmailData {
  totalContacts: number;
  totalCampaigns: number;
  avgOpenRate?: number;
  avgClickRate?: number;
}

interface StripeData {
  totalOrders: number;
  revenue: number;
  activeSubscriptions: number;
  mrr: number;
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
      <div className="font-heading mt-1 text-sm font-medium text-white">
        {label}
      </div>
      {sub && (
        <div className="font-mono mt-0.5 text-xs text-slate-500">{sub}</div>
      )}
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
      <h2 className="font-heading text-sm font-semibold uppercase tracking-widest text-slate-500">
        {icon} {title}
      </h2>
      <Link
        href={href}
        className="font-mono text-xs text-slate-500 transition hover:text-white"
      >
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

export default function UnifiedAnalyticsPage() {
  const [data, setData] = useState<UnifiedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithAuth("/api/admin/analytics/unified");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: UnifiedData = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load");
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
            <span className="text-neon-green font-mono text-xs">
              UNIFIED ANALYTICS
            </span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">
            Unified Dashboard
          </h1>
          <p className="font-body mt-1 text-slate-400">
            All KPIs in one view — SEO, revenue, pipeline, and email.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="mt-2 rounded-lg border border-slate-700 px-4 py-2 font-mono text-xs text-slate-300 transition-all hover:border-slate-600 hover:text-white disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

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
          {/* Revenue */}
          <div>
            <SectionHeader title="Revenue" icon="💳" href="/admin/orders" />
            {data.stripe ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard
                  label="Total Revenue"
                  value={`€${data.stripe.revenue.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                  color="text-neon-green"
                />
                <KpiCard
                  label="Total Orders"
                  value={String(data.stripe.totalOrders)}
                  color="text-neon-green"
                />
                <KpiCard
                  label="Active Subscriptions"
                  value={String(data.stripe.activeSubscriptions)}
                  color="text-neon-blue"
                />
                <KpiCard
                  label="MRR"
                  value={`€${data.stripe.mrr.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                  sub="monthly recurring"
                  color="text-neon-blue"
                />
              </div>
            ) : (
              <EmptyState label="Stripe" />
            )}
          </div>

          {/* SEO */}
          <div>
            <SectionHeader
              title="Search Performance"
              icon="🔍"
              href="/admin/analytics"
            />
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
                  value={`${(data.seo.ctr * 100).toFixed(1)}%`}
                  color="text-neon-blue"
                />
                <KpiCard
                  label="Avg Position"
                  value={data.seo.position.toFixed(1)}
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
            <SectionHeader
              title="Sales Pipeline"
              icon="🔀"
              href="/admin/pipeline"
            />
            {data.pipeline ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <KpiCard
                  label="Open Deals"
                  value={String(data.pipeline.totalDeals)}
                  color="text-neon-magenta"
                />
                <KpiCard
                  label="Pipeline Value"
                  value={`€${(data.pipeline.totalValue / 100).toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                  color="text-neon-magenta"
                />
                <div className="bg-void-light/50 rounded-xl border border-slate-800 p-5">
                  <div className="font-heading mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    By Stage
                  </div>
                  <div className="space-y-1">
                    {Object.entries(data.pipeline.dealsByStage).map(
                      ([stage, count]) => (
                        <div
                          key={stage}
                          className="flex justify-between font-mono text-xs"
                        >
                          <span className="truncate text-slate-400">
                            {stage}
                          </span>
                          <span className="text-neon-magenta ml-2 shrink-0">
                            {count}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState label="HubSpot pipeline" />
            )}
          </div>

          {/* Email */}
          <div>
            <SectionHeader
              title="Email Marketing"
              icon="📧"
              href="/admin/email"
            />
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
              <EmptyState label="ActiveCampaign" />
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
          })}
        </p>
      )}
    </div>
  );
}
