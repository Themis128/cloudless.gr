"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState, useCallback } from "react";
import { Link } from "@/i18n/navigation";

interface AnalyticsSummary {
  totalEvents: number;
  byType: Record<string, number>;
  topPages: { page: string; count: number }[];
  topSources: { source: string; count: number }[];
}

interface GscSnapshot {
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
  organicKeywords: number;
}

interface KpiData {
  analytics: AnalyticsSummary | null;
  gsc: GscSnapshot | null;
  projects: {
    total: number;
    byStatus: Record<string, number>;
    activeCount: number;
  };
  tasks: {
    summary: Record<string, number>;
    overdueCount: number;
  };
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
}: Readonly<{ title: string; icon: string; href: string }>) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-heading text-sm font-semibold tracking-widest text-slate-500 uppercase">
        {icon} {title}
      </h2>
      <Link
        href={href}
        className="text-neon-cyan/60 hover:text-neon-cyan font-mono text-xs transition-colors"
      >
        Details →
      </Link>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-void-light/50 animate-pulse rounded-xl border border-slate-800 p-5"
        >
          <div className="mb-2 h-7 w-20 rounded bg-slate-700/60" />
          <div className="h-4 w-28 rounded bg-slate-800/80" />
        </div>
      ))}
    </div>
  );
}

export default function KpiDashboard() {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/kpi");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as KpiData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load KPIs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const fmt = (n: number | undefined | null) => (n == null ? "—" : n.toLocaleString());

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="bg-neon-cyan/10 border-neon-cyan/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-cyan font-mono text-xs">KPI_DASHBOARD</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">KPI Dashboard</h1>
          <p className="font-body mt-1 text-slate-400">
            Consolidated view — GSC · Notion analytics · Projects · Tasks
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 rounded-lg border px-4 py-2 font-mono text-sm transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "↺ Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-10">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      )}

      {!loading && data && (
        <div className="space-y-10">
          {/* SEO — Google Search Console */}
          <section>
            <SectionHeader
              title="Search Performance (28 days)"
              icon="🔍"
              href="/admin/analytics/seo"
            />
            {data.gsc ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  label="Organic Clicks"
                  value={fmt(data.gsc.clicks)}
                  color="text-neon-cyan"
                />
                <KpiCard
                  label="Impressions"
                  value={fmt(data.gsc.impressions)}
                  color="text-neon-blue"
                />
                <KpiCard
                  label="Click-Through Rate"
                  value={`${data.gsc.ctr}%`}
                  color="text-neon-green"
                />
                <KpiCard
                  label="Avg. Position"
                  value={`#${data.gsc.avgPosition}`}
                  sub={`${fmt(data.gsc.organicKeywords)} keywords`}
                  color="text-neon-magenta"
                />
              </div>
            ) : (
              <p className="font-mono text-sm text-slate-600">
                Google Search Console not configured.
              </p>
            )}
          </section>

          {/* Notion site analytics */}
          <section>
            <SectionHeader title="Site Events (7 days)" icon="📈" href="/admin/notion/analytics" />
            {data.analytics ? (
              <>
                <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCard
                    label="Total Events"
                    value={fmt(data.analytics.totalEvents)}
                    color="text-neon-cyan"
                  />
                  <KpiCard
                    label="Page Views"
                    value={fmt(data.analytics.byType["page_view"])}
                    color="text-neon-blue"
                  />
                  <KpiCard
                    label="Blog Views"
                    value={fmt(data.analytics.byType["blog_view"])}
                    color="text-neon-green"
                  />
                  <KpiCard
                    label="Form Submits"
                    value={fmt(data.analytics.byType["form_submit"])}
                    color="text-neon-magenta"
                  />
                </div>
                {data.analytics.topPages.length > 0 && (
                  <div className="bg-void-light/30 rounded-xl border border-slate-800 p-4">
                    <p className="mb-3 font-mono text-[10px] tracking-widest text-slate-500 uppercase">
                      Top Pages
                    </p>
                    <div className="space-y-1.5">
                      {data.analytics.topPages.slice(0, 5).map((p) => (
                        <div key={p.page} className="flex items-center justify-between gap-4">
                          <span className="truncate font-mono text-xs text-slate-400">
                            {p.page || "/"}
                          </span>
                          <span className="text-neon-cyan shrink-0 font-mono text-xs">
                            {fmt(p.count)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="font-mono text-sm text-slate-600">Notion Analytics not configured.</p>
            )}
          </section>

          {/* Projects */}
          <section>
            <SectionHeader title="Projects" icon="📋" href="/admin/notion/projects" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Total Projects"
                value={fmt(data.projects.total)}
                color="text-neon-cyan"
              />
              <KpiCard
                label="Active"
                value={fmt(data.projects.activeCount)}
                sub="Planning + In Progress"
                color="text-neon-blue"
              />
              <KpiCard
                label="Completed"
                value={fmt(data.projects.byStatus["Completed"])}
                color="text-neon-green"
              />
              <KpiCard
                label="On Hold"
                value={fmt(data.projects.byStatus["On Hold"])}
                color="text-yellow-400"
              />
            </div>
          </section>

          {/* Tasks */}
          <section>
            <SectionHeader title="Tasks" icon="✅" href="/admin/notion/tasks" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="In Progress"
                value={fmt(data.tasks.summary["In Progress"])}
                color="text-neon-cyan"
              />
              <KpiCard
                label="To Do"
                value={fmt(data.tasks.summary["To Do"])}
                color="text-neon-blue"
              />
              <KpiCard
                label="Overdue"
                value={fmt(data.tasks.overdueCount)}
                color={(data.tasks.overdueCount ?? 0) > 0 ? "text-red-400" : "text-neon-green"}
              />
              <KpiCard
                label="Blocked"
                value={fmt(data.tasks.summary["Blocked"])}
                color={
                  (data.tasks.summary["Blocked"] ?? 0) > 0 ? "text-neon-magenta" : "text-slate-500"
                }
              />
            </div>
          </section>

          {/* Footer */}
          <p className="text-right font-mono text-xs text-slate-700">
            Fetched at {new Date(data.fetchedAt).toLocaleTimeString(undefined, { timeZone: "Europe/Athens" })}
          </p>
        </div>
      )}
    </div>
  );
}
