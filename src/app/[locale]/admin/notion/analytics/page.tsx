"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState, useCallback } from "react";

interface AnalyticsSummary {
  totalEvents: number;
  byType: Record<string, number>;
  topPages: { page: string; count: number }[];
  topSources: { source: string; count: number }[];
  recentEvents: AnalyticsEvent[];
}

interface AnalyticsEvent {
  id: string;
  event: string;
  type: string;
  page: string;
  source: string;
  count: number;
  date: string;
  country: string;
  metadata: string;
}

const TYPE_COLORS: Record<string, string> = {
  page_view: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30",
  form_submit: "bg-neon-green/10 text-neon-green border-neon-green/30",
  blog_view: "bg-neon-blue/10 text-neon-blue border-neon-blue/30",
  doc_view: "bg-neon-magenta/10 text-neon-magenta border-neon-magenta/30",
  signup: "bg-green-500/10 text-green-400 border-green-500/30",
  order: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  error: "bg-red-500/10 text-red-400 border-red-500/30",
  weekly_rollup: "bg-slate-700/40 text-slate-400 border-slate-600/30",
};

const TYPE_LABELS: Record<string, string> = {
  page_view: "Page Views",
  form_submit: "Form Submissions",
  blog_view: "Blog Views",
  doc_view: "Doc Views",
  signup: "Signups",
  order: "Orders",
  error: "Errors",
  weekly_rollup: "Weekly Rollups",
};

function formatDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AnalyticsDashboardPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(
        `/api/admin/notion/analytics?days=${days}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as AnalyticsSummary;
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  // Bar chart helper — renders a simple horizontal bar
  const Bar = ({
    value,
    max,
    color,
  }: {
    value: number;
    max: number;
    color: string;
  }) => (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
      />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="bg-neon-green/10 border-neon-green/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-green h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-green font-mono text-xs">
              NOTION_ANALYTICS
            </span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">
            Site Analytics
          </h1>
          <p className="font-body mt-1 text-slate-400">
            Event tracking and visitor insights from your Notion analytics
            database.
          </p>
        </div>
        <div className="flex gap-2">
          {/* Date range selector */}
          <div className="flex overflow-hidden rounded-lg border border-slate-700">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-2 font-mono text-xs transition-colors ${
                  days === d
                    ? "bg-neon-green/10 text-neon-green"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="border-neon-green/30 text-neon-green hover:bg-neon-green/10 rounded-lg border px-4 py-2 font-mono text-sm transition-colors disabled:opacity-50"
          >
            {loading ? "Loading…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-800 bg-void-light/50 p-5"
            >
              <div className="mb-2 h-3 w-20 rounded bg-slate-700/60" />
              <div className="h-8 w-16 rounded bg-slate-800/80" />
            </div>
          ))}
        </div>
      )}

      {/* Dashboard content */}
      {!loading && summary && (
        <>
          {/* KPI Cards */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-neon-cyan/20 bg-void-light/50 p-5">
              <p className="font-mono text-xs text-slate-500">Total Events</p>
              <p className="font-heading mt-1 text-3xl font-bold text-neon-cyan">
                {summary.totalEvents.toLocaleString()}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-600">
                Last {days} days
              </p>
            </div>
            <div className="rounded-xl border border-neon-green/20 bg-void-light/50 p-5">
              <p className="font-mono text-xs text-slate-500">Page Views</p>
              <p className="font-heading mt-1 text-3xl font-bold text-neon-green">
                {(summary.byType.page_view ?? 0).toLocaleString()}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-600">
                {summary.totalEvents > 0
                  ? `${Math.round(((summary.byType.page_view ?? 0) / summary.totalEvents) * 100)}% of total`
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-neon-magenta/20 bg-void-light/50 p-5">
              <p className="font-mono text-xs text-slate-500">
                Form Submissions
              </p>
              <p className="font-heading mt-1 text-3xl font-bold text-neon-magenta">
                {(summary.byType.form_submit ?? 0).toLocaleString()}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-600">
                Conversion events
              </p>
            </div>
            <div className="rounded-xl border border-yellow-500/20 bg-void-light/50 p-5">
              <p className="font-mono text-xs text-slate-500">Errors</p>
              <p
                className={`font-heading mt-1 text-3xl font-bold ${(summary.byType.error ?? 0) > 0 ? "text-red-400" : "text-neon-green"}`}
              >
                {(summary.byType.error ?? 0).toLocaleString()}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-600">
                {(summary.byType.error ?? 0) === 0
                  ? "All clear"
                  : "Needs attention"}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Events by Type */}
            <div className="rounded-xl border border-slate-800 bg-void-light/50 p-6">
              <h2 className="font-heading mb-4 font-semibold text-white">
                Events by Type
              </h2>
              <div className="space-y-3">
                {Object.entries(summary.byType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => {
                    const max = Math.max(...Object.values(summary.byType));
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <span
                          className={`w-28 shrink-0 rounded-full border px-2 py-0.5 text-center font-mono text-[10px] ${TYPE_COLORS[type] ?? TYPE_COLORS.page_view}`}
                        >
                          {TYPE_LABELS[type] ?? type}
                        </span>
                        <Bar value={count} max={max} color="bg-neon-cyan" />
                        <span className="w-10 text-right font-mono text-xs text-slate-400">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                {Object.keys(summary.byType).length === 0 && (
                  <p className="py-4 text-center font-mono text-xs text-slate-600">
                    No events yet
                  </p>
                )}
              </div>
            </div>

            {/* Top Pages */}
            <div className="rounded-xl border border-slate-800 bg-void-light/50 p-6">
              <h2 className="font-heading mb-4 font-semibold text-white">
                Top Pages
              </h2>
              <div className="space-y-3">
                {summary.topPages.map(({ page, count }, i) => {
                  const max = summary.topPages[0]?.count ?? 1;
                  return (
                    <div key={page} className="flex items-center gap-3">
                      <span className="w-4 shrink-0 text-right font-mono text-[10px] text-slate-600">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300">
                        {page}
                      </span>
                      <Bar value={count} max={max} color="bg-neon-green" />
                      <span className="w-10 text-right font-mono text-xs text-slate-400">
                        {count}
                      </span>
                    </div>
                  );
                })}
                {summary.topPages.length === 0 && (
                  <p className="py-4 text-center font-mono text-xs text-slate-600">
                    No page data
                  </p>
                )}
              </div>
            </div>

            {/* Top Sources */}
            <div className="rounded-xl border border-slate-800 bg-void-light/50 p-6">
              <h2 className="font-heading mb-4 font-semibold text-white">
                Top Sources
              </h2>
              <div className="space-y-3">
                {summary.topSources.map(({ source, count }, i) => {
                  const max = summary.topSources[0]?.count ?? 1;
                  return (
                    <div key={source} className="flex items-center gap-3">
                      <span className="w-4 shrink-0 text-right font-mono text-[10px] text-slate-600">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300">
                        {source || "(direct)"}
                      </span>
                      <Bar value={count} max={max} color="bg-neon-magenta" />
                      <span className="w-10 text-right font-mono text-xs text-slate-400">
                        {count}
                      </span>
                    </div>
                  );
                })}
                {summary.topSources.length === 0 && (
                  <p className="py-4 text-center font-mono text-xs text-slate-600">
                    No source data
                  </p>
                )}
              </div>
            </div>

            {/* Recent Events */}
            <div className="rounded-xl border border-slate-800 bg-void-light/50 p-6">
              <h2 className="font-heading mb-4 font-semibold text-white">
                Recent Events
              </h2>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {summary.recentEvents.slice(0, 15).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-700/40 bg-void/40 px-3 py-2"
                  >
                    <span
                      className={`shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[8px] ${TYPE_COLORS[event.type] ?? TYPE_COLORS.page_view}`}
                    >
                      {event.type}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300">
                      {event.event}
                    </span>
                    {event.page && (
                      <span className="hidden shrink-0 font-mono text-[9px] text-slate-600 sm:block">
                        {event.page}
                      </span>
                    )}
                    <span className="shrink-0 font-mono text-[9px] text-slate-600">
                      {formatDate(event.date)}
                    </span>
                  </div>
                ))}
                {summary.recentEvents.length === 0 && (
                  <p className="py-4 text-center font-mono text-xs text-slate-600">
                    No recent events
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && !error && !summary && (
        <div className="rounded-xl border border-slate-800 bg-void-light/30 p-12 text-center">
          <p className="font-mono text-slate-500">
            No analytics data available.
          </p>
          <p className="font-body mt-2 text-sm text-slate-600">
            Events will appear here once the tracking is active.
          </p>
        </div>
      )}
    </div>
  );
}
