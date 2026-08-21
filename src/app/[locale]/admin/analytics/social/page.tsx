"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { Link } from "@/i18n/navigation";

interface ChannelSummary {
  id: string;
  name: string;
  platform: string;
  metrics: Record<string, number>;
  percentageChanges: Record<string, number>;
}

interface PostPerformance {
  id: string;
  platform: string;
  content: string;
  publishDate: string;
  likes: number;
  comments: number;
  impressions: number;
  engagement: number;
}

interface SummaryData {
  channels: ChannelSummary[];
  topPosts: PostPerformance[];
  totals: Record<string, number>;
  lookbackDays: number;
}

interface AttributionRow {
  utm_source: string;
  utm_campaign: string;
  platform: string;
  sessions: number;
  signups: number;
  leads: number;
  purchases: number;
  revenue: number;
}

interface AttributionData {
  rows: AttributionRow[];
  totals: {
    sessions: number;
    leads: number;
    signups: number;
    revenue: number;
    conversionRate: number;
  };
}

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  "linkedin-page": "LinkedIn Page",
  x: "X (Twitter)",
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  bluesky: "Bluesky",
  tiktok: "TikTok",
  youtube: "YouTube",
};

function platformLabel(p: string) {
  return PLATFORM_LABELS[p] ?? p;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function ChangeBadge({ pct }: { pct: number }) {
  if (!Number.isFinite(pct)) return null;
  const positive = pct >= 0;
  return (
    <span
      className={`ml-1 inline-block rounded-full px-1.5 py-0.5 text-xs font-medium ${
        positive
          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      }`}
    >
      {positive ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

export default function SocialAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<SummaryData | null>(null);
  const [attribution, setAttribution] = useState<AttributionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [engRes, attrRes] = await Promise.all([
        fetchWithAuth(`/api/admin/postiz/analytics/summary?days=${days}`),
        fetchWithAuth(`/api/admin/analytics/social-attribution?days=${days}`),
      ]);
      if (engRes.status === 503) {
        setError("Postiz not configured");
        setData(null);
      } else if (engRes.ok) {
        setData(await engRes.json());
      } else {
        setError(`Engagement API error: ${engRes.status}`);
      }
      if (attrRes.ok) {
        setAttribution(await attrRes.json());
      } else if (attrRes.status !== 503) {
        setAttribution(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Social Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Engagement metrics from connected Postiz channels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* KPI cards */}
          {Object.keys(data.totals).length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(data.totals).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
                    {label}
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">{formatNum(value)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Channel breakdown */}
          {data.channels.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                Channels
              </h2>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Channel</th>
                      {data.channels[0] &&
                        Object.keys(data.channels[0].metrics).map((k) => (
                          <th key={k} className="px-4 py-2 text-right font-medium">
                            {k}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {data.channels.map((ch) => (
                      <tr key={ch.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-2 font-medium">
                          {ch.name}
                          <span className="ml-1 text-xs text-gray-400">
                            {platformLabel(ch.platform)}
                          </span>
                        </td>
                        {Object.entries(ch.metrics).map(([k, v]) => (
                          <td key={k} className="px-4 py-2 text-right tabular-nums">
                            {formatNum(v)}
                            <ChangeBadge pct={ch.percentageChanges[k] ?? 0} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top posts */}
          {data.topPosts.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                Top Posts
              </h2>
              <div className="space-y-2">
                {data.topPosts.map((post, i) => (
                  <div
                    key={post.id}
                    className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-medium">{platformLabel(post.platform)}</span>
                        <span>
                          {post.publishDate ? new Date(post.publishDate).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm">{post.content || "(no text)"}</p>
                      <div className="mt-1.5 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>{formatNum(post.impressions)} impressions</span>
                        <span>{formatNum(post.likes)} likes</span>
                        <span>{formatNum(post.comments)} comments</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.channels.length === 0 && (
            <p className="text-sm text-gray-500">
              No channels connected.{" "}
              <Link href="/admin/postiz" className="text-blue-600 underline">
                Connect channels
              </Link>{" "}
              first.
            </p>
          )}
        </>
      )}

      {/* Social → Lead Attribution */}
      {attribution && attribution.rows.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Social → Lead Attribution
          </h2>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
              <div className="text-xs font-medium text-gray-500 uppercase">Sessions</div>
              <div className="mt-1 text-xl font-bold tabular-nums">
                {formatNum(attribution.totals.sessions)}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
              <div className="text-xs font-medium text-gray-500 uppercase">Leads</div>
              <div className="mt-1 text-xl font-bold tabular-nums">
                {formatNum(attribution.totals.leads)}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
              <div className="text-xs font-medium text-gray-500 uppercase">Signups</div>
              <div className="mt-1 text-xl font-bold tabular-nums">
                {formatNum(attribution.totals.signups)}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
              <div className="text-xs font-medium text-gray-500 uppercase">Revenue</div>
              <div className="mt-1 text-xl font-bold tabular-nums">
                &euro;{formatNum(attribution.totals.revenue)}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
              <div className="text-xs font-medium text-gray-500 uppercase">Conv. Rate</div>
              <div className="mt-1 text-xl font-bold tabular-nums">
                {attribution.totals.conversionRate.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Source</th>
                  <th className="px-4 py-2 text-left font-medium">Campaign</th>
                  <th className="px-4 py-2 text-left font-medium">Platform</th>
                  <th className="px-4 py-2 text-right font-medium">Sessions</th>
                  <th className="px-4 py-2 text-right font-medium">Leads</th>
                  <th className="px-4 py-2 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {attribution.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-2">{r.utm_source}</td>
                    <td className="px-4 py-2 text-gray-500">{r.utm_campaign}</td>
                    <td className="px-4 py-2 text-gray-500">{r.platform}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.sessions}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {Number(r.leads) + Number(r.signups)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      &euro;{Number(r.revenue).toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
