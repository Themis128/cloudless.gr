/**
 * Admin - Analytics page
 *
 * Five-tab Google Search Console dashboard backed by the /api/admin/analytics/*
 * family of endpoints. Each tab fetches independently so slow tabs do not block
 * the rest of the UI.
 *
 * Tabs
 * ----
 * - Overview      - headline KPIs (clicks, impressions, CTR, position)
 * - Keywords      - top search queries sortable by any metric
 * - Pages         - top landing pages by clicks
 * - History       - 16-week click/impression trend chart (SVG sparkline)
 * - CTR Opps      - pages with high impressions but below-average CTR
 *
 * All requests carry the Cognito session token via fetchWithAuth.
 *
 * @module admin/analytics
 */
"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeoSnapshot {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface Keyword {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface Page {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface HistoryPoint {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface CtrOpportunity {
  keyword: string;
  position: number;
  impressions: number;
  ctr: number;
  clicks: number;
  potentialClicks: number;
}

interface WebAnalytics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// ─── Helper components ────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
      <p className="font-mono text-[10px] text-slate-500">{label}</p>
      <p className={`font-heading mt-1 text-xl font-bold ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="bg-void-light/50 flex items-center justify-center rounded-xl border border-slate-800 py-16">
      <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
    </div>
  );
}

function ErrorState({ msg }: { msg: string }) {
  return (
    <div className="bg-void-light/50 rounded-xl border border-red-900/30 p-6 text-center">
      <p className="font-mono text-sm text-red-400">{msg}</p>
      <p className="mt-2 text-xs text-slate-500">
        Make sure GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY are set in SSM.
      </p>
    </div>
  );
}

function positionColor(pos: number): string {
  if (pos <= 3) return "text-neon-green";
  if (pos <= 10) return "text-neon-cyan";
  if (pos <= 20) return "text-yellow-400";
  return "text-slate-400";
}

function ctrColor(ctr: number): string {
  if (ctr >= 0.1) return "text-neon-green";
  if (ctr >= 0.05) return "text-neon-cyan";
  if (ctr >= 0.02) return "text-yellow-400";
  return "text-slate-500";
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, field }: { data: HistoryPoint[]; field: "clicks" | "impressions" }) {
  if (!data.length) return null;
  const vals = data.map((d) => d[field]);
  const max = Math.max(...vals) || 1;
  const min = Math.min(...vals);
  const W = 240;
  const H = 48;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - ((v - min) / (max - min || 1)) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={field === "clicks" ? "#a855f7" : "#22d3ee"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "keywords" | "pages" | "history" | "ctr";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "keywords", label: "Keywords" },
  { id: "pages", label: "Top Pages" },
  { id: "history", label: "History" },
  { id: "ctr", label: "CTR Opportunities" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [tab, setTab] = useState<Tab>("overview");

  // ── Data state ──
  const [snapshot, setSnapshot] = useState<SeoSnapshot | null>(null);
  const [web, setWeb] = useState<WebAnalytics | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [opportunities, setOpportunities] = useState<CtrOpportunity[]>([]);

  // ── Loading / error per tab ──
  const [loadingTab, setLoadingTab] = useState<Record<Tab, boolean>>({
    overview: false, keywords: false, pages: false, history: false, ctr: false,
  });
  const [errors, setErrors] = useState<Record<Tab, string | null>>({
    overview: null, keywords: null, pages: null, history: null, ctr: null,
  });
  const [fetchedTabs, setFetchedTabs] = useState<Set<Tab>>(new Set());

  const setLoading = (t: Tab, v: boolean) => setLoadingTab((p) => ({ ...p, [t]: v }));
  const setError = (t: Tab, v: string | null) => setErrors((p) => ({ ...p, [t]: v }));
  const markFetched = (t: Tab) => setFetchedTabs((p) => new Set(p).add(t));

  const fetchOverview = useCallback(async () => {
    setLoading("overview", true);
    setError("overview", null);
    try {
      const [seoRes, webRes] = await Promise.allSettled([
        fetchWithAuth("/api/admin/analytics/seo"),
        fetchWithAuth("/api/admin/analytics/web"),
      ]);
      if (seoRes.status === "fulfilled" && seoRes.value.ok) {
        const d = await seoRes.value.json();
        setSnapshot(d.snapshot ?? null);
      } else {
        setError("overview", "Failed to load GSC overview");
      }
      if (webRes.status === "fulfilled" && webRes.value.ok) {
        const d = await webRes.value.json();
        setWeb(d.analytics ?? null);
      }
    } finally {
      setLoading("overview", false);
      markFetched("overview");
    }
  }, []);

  const fetchKeywords = useCallback(async () => {
    setLoading("keywords", true);
    setError("keywords", null);
    try {
      const res = await fetchWithAuth("/api/admin/analytics/keywords?limit=50");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setKeywords(d.keywords ?? []);
    } catch (err) {
      setError("keywords", err instanceof Error ? err.message : "Failed to load keywords");
    } finally {
      setLoading("keywords", false);
      markFetched("keywords");
    }
  }, []);

  const fetchPages = useCallback(async () => {
    setLoading("pages", true);
    setError("pages", null);
    try {
      const res = await fetchWithAuth("/api/admin/analytics/pages?limit=25");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setPages(d.pages ?? []);
    } catch (err) {
      setError("pages", err instanceof Error ? err.message : "Failed to load pages");
    } finally {
      setLoading("pages", false);
      markFetched("pages");
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading("history", true);
    setError("history", null);
    try {
      const res = await fetchWithAuth("/api/admin/analytics/history?weeks=16");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setHistory(d.history ?? []);
    } catch (err) {
      setError("history", err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading("history", false);
      markFetched("history");
    }
  }, []);

  const fetchCtr = useCallback(async () => {
    setLoading("ctr", true);
    setError("ctr", null);
    try {
      const res = await fetchWithAuth("/api/admin/analytics/ctr-opportunities?limit=40");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setOpportunities(d.opportunities ?? []);
    } catch (err) {
      setError("ctr", err instanceof Error ? err.message : "Failed to load CTR opportunities");
    } finally {
      setLoading("ctr", false);
      markFetched("ctr");
    }
  }, []);

  // Lazy-load: only fetch when tab is first opened
  useEffect(() => {
    if (!fetchedTabs.has(tab)) {
      if (tab === "overview") fetchOverview();
      if (tab === "keywords") fetchKeywords();
      if (tab === "pages") fetchPages();
      if (tab === "history") fetchHistory();
      if (tab === "ctr") fetchCtr();
    }
  }, [tab, fetchedTabs, fetchOverview, fetchKeywords, fetchPages, fetchHistory, fetchCtr]);

  const currentLoading = loadingTab[tab];
  const currentError = errors[tab];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">ANALYTICS</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">SEO & Analytics</h1>
        <p className="font-body mt-1 text-slate-400">
          Performance data from Google Search Console — clicks, impressions, rankings.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-[36px] rounded-lg px-4 py-1.5 font-mono text-xs transition-all ${
              tab === t.id
                ? "bg-neon-magenta/10 text-neon-magenta border-neon-magenta/20 border"
                : "border border-slate-800 text-slate-500 hover:border-slate-700 hover:text-white"
            }`}
          >
            {t.label}
            {t.id === "ctr" && opportunities.length > 0 && (
              <span className="ml-1.5 rounded-full bg-yellow-400/20 px-1.5 py-0.5 text-[9px] text-yellow-400">
                {opportunities.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {currentLoading ? (
        <LoadingState />
      ) : currentError ? (
        <ErrorState msg={currentError} />
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <div className="space-y-6">
              <div>
                <p className="mb-3 font-mono text-xs text-slate-500">Last 28 days · Google Search Console</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatCard label="Total Clicks" value={snapshot?.clicks?.toLocaleString() ?? "—"} accent="text-neon-magenta" />
                  <StatCard label="Impressions" value={snapshot?.impressions?.toLocaleString() ?? "—"} accent="text-neon-cyan" />
                  <StatCard label="Avg CTR" value={snapshot ? pct(snapshot.ctr) : "—"} accent="text-neon-green" />
                  <StatCard label="Avg Position" value={snapshot ? snapshot.position.toFixed(1) : "—"} accent="text-yellow-400" />
                </div>
              </div>

              {web && (
                <div>
                  <p className="mb-3 font-mono text-xs text-slate-500">Organic search summary</p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <StatCard label="Clicks (organic)" value={web.clicks?.toLocaleString() ?? "—"} />
                    <StatCard label="Impressions" value={web.impressions?.toLocaleString() ?? "—"} />
                    <StatCard label="CTR" value={web ? pct(web.ctr) : "—"} />
                    <StatCard label="Position" value={web ? web.position.toFixed(1) : "—"} />
                  </div>
                </div>
              )}

              {/* Quick links to other tabs */}
              <div className="bg-void-light/50 rounded-xl border border-slate-800 p-5">
                <p className="mb-3 font-mono text-xs text-slate-500">Explore deeper</p>
                <div className="flex flex-wrap gap-2">
                  {(["keywords", "pages", "history", "ctr"] as Tab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className="hover:border-neon-magenta/30 hover:text-neon-magenta rounded-lg border border-slate-700 px-3 py-1.5 font-mono text-xs text-slate-400 transition-all"
                    >
                      {TABS.find((x) => x.id === t)?.label} →
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── KEYWORDS ── */}
          {tab === "keywords" && (
            <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
                <h3 className="font-mono text-xs font-medium text-slate-400">
                  Top {keywords.length} Keywords by Clicks
                </h3>
                <span className="font-mono text-[10px] text-slate-600">Google Search Console</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">#</th>
                      <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Keyword</th>
                      <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">Clicks</th>
                      <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">Impr.</th>
                      <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">CTR</th>
                      <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">Pos.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keywords.map((kw, i) => (
                      <tr key={i} className="hover:bg-void-lighter/30 border-b border-slate-800/50 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs text-slate-600">{i + 1}</td>
                        <td className="px-6 py-3 text-white">{kw.keyword}</td>
                        <td className="px-6 py-3 text-right font-mono text-sm text-white">{kw.clicks.toLocaleString()}</td>
                        <td className="px-6 py-3 text-right font-mono text-xs text-slate-400">{kw.impressions.toLocaleString()}</td>
                        <td className={`px-6 py-3 text-right font-mono text-xs ${ctrColor(kw.ctr)}`}>{pct(kw.ctr)}</td>
                        <td className={`px-6 py-3 text-right font-mono text-sm font-semibold ${positionColor(kw.position)}`}>
                          #{kw.position.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                    {keywords.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center font-mono text-slate-600">No keyword data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TOP PAGES ── */}
          {tab === "pages" && (
            <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
                <h3 className="font-mono text-xs font-medium text-slate-400">Top {pages.length} Pages by Clicks</h3>
                <span className="font-mono text-[10px] text-slate-600">Google Search Console</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">#</th>
                      <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Page</th>
                      <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">Clicks</th>
                      <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">Impr.</th>
                      <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">CTR</th>
                      <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">Pos.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pages.map((pg, i) => {
                      // Strip domain for display
                      let display = pg.page;
                      try { display = new URL(pg.page).pathname || "/"; } catch { /* keep raw */ }
                      return (
                        <tr key={i} className="hover:bg-void-lighter/30 border-b border-slate-800/50 transition-colors">
                          <td className="px-6 py-3 font-mono text-xs text-slate-600">{i + 1}</td>
                          <td className="px-6 py-3">
                            <a
                              href={pg.page}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-neon-cyan truncate font-mono text-xs hover:underline"
                              title={pg.page}
                            >
                              {display}
                            </a>
                          </td>
                          <td className="px-6 py-3 text-right font-mono text-sm text-white">{pg.clicks.toLocaleString()}</td>
                          <td className="px-6 py-3 text-right font-mono text-xs text-slate-400">{pg.impressions.toLocaleString()}</td>
                          <td className={`px-6 py-3 text-right font-mono text-xs ${ctrColor(pg.ctr)}`}>{pct(pg.ctr)}</td>
                          <td className={`px-6 py-3 text-right font-mono text-sm font-semibold ${positionColor(pg.position)}`}>
                            #{pg.position.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                    {pages.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center font-mono text-slate-600">No page data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── HISTORY ── */}
          {tab === "history" && (
            <div className="space-y-6">
              {history.length > 0 ? (
                <>
                  {/* Sparklines */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="bg-void-light/50 rounded-xl border border-slate-800 p-5">
                      <p className="mb-1 font-mono text-xs text-slate-500">Clicks (16 weeks)</p>
                      <p className="font-heading mb-3 text-2xl font-bold text-neon-magenta">
                        {history.reduce((s, h) => s + h.clicks, 0).toLocaleString()}
                      </p>
                      <Sparkline data={history} field="clicks" />
                    </div>
                    <div className="bg-void-light/50 rounded-xl border border-slate-800 p-5">
                      <p className="mb-1 font-mono text-xs text-slate-500">Impressions (16 weeks)</p>
                      <p className="font-heading mb-3 text-2xl font-bold text-neon-cyan">
                        {history.reduce((s, h) => s + h.impressions, 0).toLocaleString()}
                      </p>
                      <Sparkline data={history} field="impressions" />
                    </div>
                  </div>

                  {/* Table */}
                  <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
                    <div className="border-b border-slate-800 px-6 py-3">
                      <h3 className="font-mono text-xs font-medium text-slate-400">Weekly Breakdown</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-800">
                            <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Week of</th>
                            <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">Clicks</th>
                            <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">Impressions</th>
                            <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">CTR</th>
                            <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">Avg Pos.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...history].reverse().map((h, i) => (
                            <tr key={i} className="hover:bg-void-lighter/30 border-b border-slate-800/50 transition-colors">
                              <td className="px-6 py-3 font-mono text-xs text-slate-300">
                                {new Date(h.date).toLocaleDateString("en-IE", { month: "short", day: "numeric" })}
                              </td>
                              <td className="px-6 py-3 text-right font-mono text-sm text-white">{h.clicks.toLocaleString()}</td>
                              <td className="px-6 py-3 text-right font-mono text-xs text-slate-400">{h.impressions.toLocaleString()}</td>
                              <td className={`px-6 py-3 text-right font-mono text-xs ${ctrColor(h.ctr)}`}>{pct(h.ctr)}</td>
                              <td className={`px-6 py-3 text-right font-mono text-xs ${positionColor(h.position)}`}>
                                {h.position.toFixed(1)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-void-light/50 rounded-xl border border-slate-800 p-12 text-center">
                  <p className="font-mono text-sm text-slate-500">No history data available yet.</p>
                </div>
              )}
            </div>
          )}

          {/* ── CTR OPPORTUNITIES ── */}
          {tab === "ctr" && (
            <div className="space-y-4">
              <div className="bg-yellow-950/20 rounded-xl border border-yellow-900/30 p-4">
                <p className="font-mono text-xs text-yellow-400">
                  ⚡ These keywords rank position 4–20 with high impressions but low CTR (&lt;5%).
                  Improving your title/meta description for these queries could significantly boost organic traffic.
                </p>
              </div>

              <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
                  <h3 className="font-mono text-xs font-medium text-slate-400">
                    {opportunities.length} CTR Opportunities
                  </h3>
                  <span className="font-mono text-[10px] text-slate-600">Sorted by potential</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Keyword</th>
                        <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">Pos.</th>
                        <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">Impr.</th>
                        <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">Current CTR</th>
                        <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">Clicks</th>
                        <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">Potential ↑</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opportunities.map((opp, i) => (
                        <tr key={i} className="hover:bg-void-lighter/30 border-b border-slate-800/50 transition-colors">
                          <td className="px-6 py-3 text-white">{opp.keyword}</td>
                          <td className={`px-6 py-3 text-right font-mono text-xs ${positionColor(opp.position)}`}>
                            #{opp.position.toFixed(1)}
                          </td>
                          <td className="px-6 py-3 text-right font-mono text-xs text-slate-400">
                            {opp.impressions.toLocaleString()}
                          </td>
                          <td className="px-6 py-3 text-right font-mono text-xs text-red-400">
                            {pct(opp.ctr)}
                          </td>
                          <td className="px-6 py-3 text-right font-mono text-xs text-slate-400">
                            {opp.clicks.toLocaleString()}
                          </td>
                          <td className="px-6 py-3 text-right font-mono text-xs text-neon-green font-semibold">
                            +y(opp.potentialClicks ?? 0).toLocaleString()} clicks
                          </td>
                        </tr>
                      ))}
                      {opportunities.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center font-mono text-slate-600">
                            No CTR opportunities found — your CTRs look healthy!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
