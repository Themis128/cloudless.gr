"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

/* Shapes match gold SEO payloads from /api/admin/analytics/* (not live gsc.ts). */
interface SeoSnapshot {
  clicks: number;
  impressions: number;
  /** % */
  ctr: number;
  avgPosition: number;
  organicKeywords: number;
}

interface KeywordRow {
  keyword: string;
  clicks: number;
  impressions: number;
  /** % */
  ctr: number;
  position: number;
}

interface IntentBreakdown {
  brand: KeywordRow[];
  product: KeywordRow[];
  informational: KeywordRow[];
  navigational: KeywordRow[];
}

/** One persisted weekly snapshot from the R2 GSC archive. */
interface ArchiveRow {
  id: string;
  week: string;
  date: string;
  clicks: number;
  impressions: number;
  /** whole percent */
  ctrPct: number;
  avgPosition: number;
  keywords: number;
  topCountry: string;
  mobilePct: number;
  ctrOpportunities: number;
}

/** Response types for API endpoints */
interface SeoResponse {
  snapshot: SeoSnapshot;
  keywords: KeywordRow[];
}

interface IntentResponse {
  intent: IntentBreakdown;
}

interface ArchiveResponse {
  reports: ArchiveRow[];
}

interface DimensionMetricRow {
  clicks: number;
  impressions: number;
  ctr: number;
  position?: number;
  avgPosition?: number;
  page?: string;
  country?: string;
  device?: string;
}

export default function SeoAnalyticsPage() {
  const [snapshot, setSnapshot] = useState<SeoSnapshot | null>(null);
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [intent, setIntent] = useState<IntentBreakdown | null>(null);
  const [archive, setArchive] = useState<ArchiveRow[]>([]);
  const [pages, setPages] = useState<DimensionMetricRow[]>([]);
  const [countries, setCountries] = useState<DimensionMetricRow[]>([]);
  const [devices, setDevices] = useState<DimensionMetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [seoRes, intentRes, archiveRes, pagesRes, countriesRes, devicesRes] =
        await Promise.all([
          fetchWithAuth("/api/admin/analytics/seo"),
          fetchWithAuth("/api/admin/analytics/search-intent"),
          fetchWithAuth("/api/admin/analytics/gsc-archive?limit=26"),
          fetchWithAuth("/api/admin/analytics/pages?limit=25&days=28"),
          fetchWithAuth("/api/admin/analytics/countries?days=28"),
          fetchWithAuth("/api/admin/analytics/devices?days=28"),
        ]);
      if (seoRes.status === 503) {
        setNotConfigured(true);
        return;
      }
      if (!seoRes.ok) throw new Error("Failed to load SEO snapshot");

      const seo = (await seoRes.json()) as SeoResponse;
      setSnapshot(seo.snapshot ?? null);
      setKeywords(seo.keywords ?? []);

      if (intentRes.ok) {
        const intentData = (await intentRes.json()) as IntentResponse;
        setIntent(intentData?.intent ?? null);
      }
      if (archiveRes.ok) {
        const archiveData = (await archiveRes.json()) as ArchiveResponse;
        setArchive(archiveData?.reports ?? []);
      }
      if (pagesRes.ok) {
        const data = (await pagesRes.json()) as { pages?: DimensionMetricRow[] };
        setPages(data.pages ?? []);
      }
      if (countriesRes.ok) {
        const data = (await countriesRes.json()) as { countries?: DimensionMetricRow[] };
        setCountries(data.countries ?? []);
      }
      if (devicesRes.ok) {
        const data = (await devicesRes.json()) as { devices?: DimensionMetricRow[] };
        setDevices(data.devices ?? []);
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
      <div>
        <BackLink />
        <div className="rounded-xl border border-yellow-900/30 bg-yellow-950/10 p-6">
          <p className="font-mono text-sm text-yellow-400">
            Google Search Console is not configured. Set{" "}
            <code className="text-yellow-300">GOOGLE_CLIENT_EMAIL</code> and{" "}
            <code className="text-yellow-300">GOOGLE_PRIVATE_KEY</code> as Wrangler secrets (or in
            D1 <code className="text-yellow-300">app_config</code>).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackLink />
      <div className="mb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="font-mono text-xs text-emerald-400">GOOGLE SEARCH CONSOLE</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">SEO Deep Dive</h1>
        <p className="mt-1 font-mono text-xs text-slate-500">
          Organic search from gold GSC snapshots — last 28 days (keywords, pages, countries,
          devices).
        </p>
      </div>

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {!loading && !error && (
        <div className="space-y-10">
          {snapshot && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <MetricCard label="Organic Clicks" value={snapshot.clicks.toLocaleString()} />
              <MetricCard label="Impressions" value={snapshot.impressions.toLocaleString()} />
              <MetricCard label="CTR" value={`${snapshot.ctr}%`} />
              <MetricCard label="Avg Position" value={snapshot.avgPosition.toFixed(1)} />
              <MetricCard label="Keywords" value={snapshot.organicKeywords.toLocaleString()} />
            </div>
          )}

          {intent && (
            <section>
              <h2 className="mb-3 font-mono text-xs font-medium tracking-wider text-slate-400">
                SEARCH INTENT
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <IntentBucket title="Brand" rows={intent.brand} color="text-neon-cyan" />
                <IntentBucket title="Product" rows={intent.product} color="text-neon-green" />
                <IntentBucket
                  title="Informational"
                  rows={intent.informational}
                  color="text-blue-400"
                />
                <IntentBucket
                  title="Navigational"
                  rows={intent.navigational}
                  color="text-purple-400"
                />
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 font-mono text-xs font-medium tracking-wider text-slate-400">
              TOP KEYWORDS
            </h2>
            <SeoTable
              head={["Keyword", "Clicks", "Impressions", "CTR", "Position"]}
              empty="No keyword data."
              rows={keywords.map((k) => [
                k.keyword,
                k.clicks.toLocaleString(),
                k.impressions.toLocaleString(),
                `${k.ctr}%`,
                k.position.toFixed(1),
              ])}
            />
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-medium tracking-wider text-slate-400">
              TOP PAGES
            </h2>
            <SeoTable
              head={["Page", "Clicks", "Impressions", "CTR", "Position"]}
              empty="No page gold yet — run gsc-to-r2 + materialize."
              rows={pages.map((r) => [
                r.page ?? "—",
                r.clicks.toLocaleString(),
                r.impressions.toLocaleString(),
                `${((r.ctr <= 1 ? r.ctr * 100 : r.ctr)).toFixed(1)}%`,
                (r.position ?? r.avgPosition ?? 0).toFixed(1),
              ])}
            />
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-medium tracking-wider text-slate-400">
              COUNTRIES
            </h2>
            <SeoTable
              head={["Country", "Clicks", "Impressions", "CTR", "Avg Pos"]}
              empty="No country gold yet — next gsc-to-r2 run writes countries.parquet."
              rows={countries.map((r) => [
                r.country ?? "—",
                r.clicks.toLocaleString(),
                r.impressions.toLocaleString(),
                `${((r.ctr <= 1 ? r.ctr * 100 : r.ctr)).toFixed(1)}%`,
                (r.avgPosition ?? r.position ?? 0).toFixed(1),
              ])}
            />
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-medium tracking-wider text-slate-400">
              DEVICES
            </h2>
            <SeoTable
              head={["Device", "Clicks", "Impressions", "CTR", "Avg Pos"]}
              empty="No device gold yet — next gsc-to-r2 run writes devices.parquet."
              rows={devices.map((r) => [
                r.device ?? "—",
                r.clicks.toLocaleString(),
                r.impressions.toLocaleString(),
                `${((r.ctr <= 1 ? r.ctr * 100 : r.ctr)).toFixed(1)}%`,
                (r.avgPosition ?? r.position ?? 0).toFixed(1),
              ])}
            />
          </section>

          {archive.length > 0 && (
            <section>
              <h2 className="mb-3 font-mono text-xs font-medium tracking-wider text-slate-400">
                WEEKLY ARCHIVE <span className="text-slate-600">— R2 gold snapshots</span>
              </h2>
              <SeoTable
                head={[
                  "Week",
                  "Clicks",
                  "Impressions",
                  "CTR",
                  "Avg Pos",
                  "Keywords",
                  "Mobile",
                  "Top Country",
                  "CTR Opps",
                ]}
                empty="No archived snapshots yet."
                rows={archive.map((a) => [
                  a.week,
                  a.clicks.toLocaleString(),
                  a.impressions.toLocaleString(),
                  `${a.ctrPct}%`,
                  a.avgPosition.toFixed(1),
                  a.keywords.toLocaleString(),
                  `${a.mobilePct}%`,
                  a.topCountry || "—",
                  a.ctrOpportunities.toLocaleString(),
                ])}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <div className="mb-6">
      <Link
        href="/admin/analytics"
        className="font-mono text-xs text-slate-500 hover:text-slate-300"
      >
        ← Analytics
      </Link>
    </div>
  );
}

function MetricCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="bg-void-light/50 rounded-xl border border-slate-800 p-3">
      <p className="font-mono text-[10px] text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function IntentBucket({
  title,
  rows,
  color,
}: {
  readonly title: string;
  readonly rows: KeywordRow[];
  readonly color: string;
}) {
  return (
    <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <p className={`font-mono text-xs font-medium ${color}`}>{title}</p>
        <p className="font-mono text-lg font-bold text-white">{rows.length}</p>
      </div>
      <ul className="space-y-1">
        {rows.slice(0, 5).map((r) => (
          <li key={r.keyword} className="truncate font-mono text-[11px] text-slate-400">
            {r.keyword}
            <span className="ml-1 text-slate-600">({r.clicks})</span>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="font-mono text-[11px] text-slate-600">No keywords.</li>
        )}
      </ul>
    </div>
  );
}

function SeoTable({
  head,
  rows,
  empty,
}: {
  readonly head: string[];
  readonly rows: string[][];
  readonly empty: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              {head.map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 font-mono text-xs text-slate-500 ${
                    i === 0 || i === 1 ? "text-left" : "text-right"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={head.length}
                  className="py-8 text-center font-mono text-sm text-slate-600"
                >
                  {empty}
                </td>
              </tr>
            )}
            {rows.map((cells, ri) => (
              <tr key={`${cells[0]}-${ri}`} className="transition-colors hover:bg-slate-800/30">
                {cells.map((c, ci) => (
                  <td
                    key={`${ci}-${c}`}
                    className={`max-w-xs truncate px-4 py-2.5 font-mono text-xs ${
                      ci === 0
                        ? "text-white"
                        : ci === 1
                          ? "text-slate-400"
                          : "text-right text-slate-300"
                    }`}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center gap-3 text-slate-400">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
      <span className="font-mono text-sm">Loading...</span>
    </div>
  );
}

function ErrorMsg({ msg }: { readonly msg: string }) {
  return (
    <div className="rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-sm text-red-400">
      {msg}
    </div>
  );
}
