"use client";

import { useEffect, useState } from "react";

interface SeoData {
  snapshot: {
    domainRating: number;
    organicKeywords: number;
    organicTraffic: number;
    backlinks: number;
    referringDomains: number;
  } | null;
  topKeywords: { keyword: string; position: number; traffic: number; volume: number }[];
  fetchedAt: string;
}

interface WebData {
  analytics: {
    pageviews: number;
    visitors: number;
    visits: number;
    bounceRate: number;
    avgDuration: number;
  } | null;
  fetchedAt: string;
}

export default function AdminAnalyticsPage() {
  const [seo, setSeo] = useState<SeoData | null>(null);
  const [web, setWeb] = useState<WebData | null>(null);
  const [loading, setLoading] = useState(true);
  const [seoError, setSeoError] = useState<string | null>(null);
  const [webError, setWebError] = useState<string | null>(null);
  const [tab, setTab] = useState<"seo" | "web">("seo");

  useEffect(() => {
    async function fetchAll() {
      const [seoRes, webRes] = await Promise.allSettled([
        fetch("/api/admin/analytics/seo"),
        fetch("/api/admin/analytics/web"),
      ]);

      if (seoRes.status === "fulfilled" && seoRes.value.ok) {
        setSeo(await seoRes.value.json());
      } else {
        setSeoError(
          seoRes.status === "fulfilled" && seoRes.value.status === 503
            ? "Ahrefs not configured"
            : "Failed to load SEO data",
        );
      }

      if (webRes.status === "fulfilled" && webRes.value.ok) {
        setWeb(await webRes.value.json());
      } else {
        setWebError(
          webRes.status === "fulfilled" && webRes.value.status === 503
            ? "Ahrefs not configured"
            : "Failed to load web analytics",
        );
      }

      setLoading(false);
    }
    fetchAll();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">ANALYTICS</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">SEO & Web Analytics</h1>
        <p className="font-body mt-1 text-slate-400">
          Domain performance and traffic data from Ahrefs.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {(["seo", "web"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`min-h-[36px] rounded-lg px-4 py-1.5 font-mono text-xs transition-all ${
              tab === t
                ? "bg-neon-magenta/10 text-neon-magenta border-neon-magenta/20 border"
                : "border border-slate-800 text-slate-500 hover:border-slate-700 hover:text-white"
            }`}
          >
            {t === "seo" ? "SEO Overview" : "Web Traffic"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-void-light/50 flex items-center justify-center rounded-xl border border-slate-800 py-16">
          <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      ) : tab === "seo" ? (
        seoError ? (
          <div className="bg-void-light/50 rounded-xl border border-red-900/30 p-6 text-center">
            <p className="font-mono text-sm text-red-400">{seoError}</p>
            <p className="mt-2 text-xs text-slate-500">Set AHREFS_API_KEY in your environment.</p>
          </div>
        ) : (
          <>
            {/* SEO Metrics */}
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
              {[
                { label: "Domain Rating", value: seo?.snapshot?.domainRating ?? "—", accent: "neon-magenta" },
                { label: "Organic Keywords", value: seo?.snapshot?.organicKeywords?.toLocaleString() ?? "—", accent: "neon-cyan" },
                { label: "Organic Traffic", value: seo?.snapshot?.organicTraffic?.toLocaleString() ?? "—", accent: "neon-green" },
                { label: "Backlinks", value: seo?.snapshot?.backlinks?.toLocaleString() ?? "—", accent: "neon-blue" },
                { label: "Ref. Domains", value: seo?.snapshot?.referringDomains?.toLocaleString() ?? "—", accent: "neon-magenta" },
              ].map((stat) => (
                <div key={stat.label} className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
                  <p className="font-mono text-[10px] text-slate-500">{stat.label}</p>
                  <p className="font-heading mt-1 text-xl font-bold text-white">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Top Keywords */}
            <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
              <div className="border-b border-slate-800 px-6 py-3">
                <h3 className="font-mono text-xs font-medium text-slate-400">Top Organic Keywords</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Keyword</th>
                      <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Position</th>
                      <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Traffic</th>
                      <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(seo?.topKeywords ?? []).map((kw, i) => (
                      <tr key={i} className="hover:bg-void-lighter/30 border-b border-slate-800/50 transition-colors">
                        <td className="px-6 py-4 text-white">{kw.keyword}</td>
                        <td className="px-6 py-4">
                          <span className={`font-mono text-xs ${kw.position <= 3 ? "text-neon-green" : kw.position <= 10 ? "text-neon-cyan" : "text-slate-400"}`}>
                            #{kw.position}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-300">{kw.traffic.toLocaleString()}</td>
                        <td className="px-6 py-4 font-mono text-slate-500">{kw.volume.toLocaleString()}</td>
                      </tr>
                    ))}
                    {(seo?.topKeywords ?? []).length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center font-mono text-slate-600">No keyword data yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      ) : webError ? (
        <div className="bg-void-light/50 rounded-xl border border-red-900/30 p-6 text-center">
          <p className="font-mono text-sm text-red-400">{webError}</p>
          <p className="mt-2 text-xs text-slate-500">Set AHREFS_API_KEY in your environment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            { label: "Pageviews", value: web?.analytics?.pageviews?.toLocaleString() ?? "—" },
            { label: "Visitors", value: web?.analytics?.visitors?.toLocaleString() ?? "—" },
            { label: "Visits", value: web?.analytics?.visits?.toLocaleString() ?? "—" },
            { label: "Bounce Rate", value: web?.analytics?.bounceRate != null ? `${(web.analytics.bounceRate * 100).toFixed(1)}%` : "—" },
            { label: "Avg Duration", value: web?.analytics?.avgDuration != null ? `${Math.round(web.analytics.avgDuration)}s` : "—" },
          ].map((stat) => (
            <div key={stat.label} className="bg-void-light/50 rounded-xl border border-slate-800 p-6 text-center">
              <p className="font-mono text-[10px] text-slate-500">{stat.label}</p>
              <p className="font-heading mt-2 text-3xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {seo?.fetchedAt && (
        <p className="mt-4 font-mono text-[10px] text-slate-600">
          Last updated: {new Date(seo.fetchedAt).toLocaleString("en-IE")}
        </p>
      )}
    </div>
  );
}
