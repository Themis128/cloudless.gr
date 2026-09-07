"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useState } from "react";

/* ─── Types matching the API responses ──────────────────────────────────── */

interface SitemapEntry {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending: boolean;
  isSitemapsIndex: boolean;
  type: string;
  errors?: string;
  warnings?: string;
  contents?: Array<{ type: string; submitted: string; indexed: string }>;
}

interface InspectionResult {
  url: string;
  inspectionResult: {
    inspectionStatus: string;
    indexStatusResult?: {
      verdict: string;
      coverageState: string;
      robotsTxtState: string;
      indexed?: boolean;
      lastCrawlTime?: string;
      pageFetchState: string;
      googleCanonical?: string;
      userCanonical?: string;
      sitemap?: string;
      crawledAs?: string;
    };
    mobileUsabilityResult?: {
      verdict: string;
      issues?: Array<{ issueType: string; severity: string; message: string }>;
    };
    richResultsResult?: {
      verdict: string;
      detectedItems?: Array<{ richResultType: string; items: number }>;
    };
  };
}

interface CrawlStatsSample {
  url: string;
  lastCrawlTime?: string;
  responseState?: string;
  crawlState?: string;
}

interface CrawlStatsSummary {
  category: string;
  pageCount: number;
  sampleUrls: CrawlStatsSample[];
}

/* ─── Tabs ──────────────────────────────────────────────────────────────── */

type Tab = "sitemaps" | "inspect" | "index" | "crawl";

const TABS: { id: Tab; label: string; icon: string; hint: string }[] = [
  { id: "sitemaps", label: "Sitemaps", icon: "🗺️", hint: "Submit & monitor sitemaps" },
  { id: "inspect", label: "URL Inspection", icon: "🔍", hint: "Check index status of a URL" },
  {
    id: "index",
    label: "Request Indexing",
    icon: "🚀",
    hint: "Notify Google of new/updated pages",
  },
  { id: "crawl", label: "Crawl Errors", icon: "⚠️", hint: "See pages Google can't reach" },
];

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function verdictColor(verdict: string): string {
  if (verdict === "PASS") return "text-green-600 dark:text-green-400";
  if (verdict === "FAIL" || verdict === "NEUTRAL") return "text-red-600 dark:text-red-400";
  return "text-gray-500 dark:text-gray-400";
}

function verdictIcon(verdict: string): string {
  if (verdict === "PASS") return "✅";
  if (verdict === "FAIL") return "❌";
  if (verdict === "NEUTRAL") return "⚠️";
  return "⚪";
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    not_found: "404 Not Found",
    server_error: "Server Errors (5xx)",
    soft_404: "Soft 404s",
    ok: "Successfully Crawled",
  };
  return map[cat] ?? cat;
}

function categoryColor(cat: string): string {
  if (cat === "ok") return "border-green-300 dark:border-green-800";
  if (cat === "not_found") return "border-yellow-300 dark:border-yellow-800";
  return "border-red-300 dark:border-red-800";
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function GscAdminPage() {
  const [tab, setTab] = useState<Tab>("sitemaps");

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="mb-1 text-3xl font-bold">Google Search Console</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage sitemaps, inspect URLs, request indexing, and monitor crawl errors — all from your
          admin backend.
        </p>
      </header>

      {/* Tab navigation */}
      <nav className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
            title={t.hint}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "sitemaps" && <SitemapsTab />}
      {tab === "inspect" && <InspectTab />}
      {tab === "index" && <IndexTab />}
      {tab === "crawl" && <CrawlTab />}
    </div>
  );
}

/* ─── Sitemaps Tab ──────────────────────────────────────────────────────── */

function SitemapsTab() {
  const [sitemaps, setSitemaps] = useState<SitemapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [submitPath, setSubmitPath] = useState("sitemap.xml");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/gsc/sitemaps");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { sitemaps: SitemapEntry[] };
      setSitemaps(data.sitemaps);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setActionMsg(null);
    try {
      const res = await fetchWithAuth("/api/admin/gsc/sitemaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: submitPath.trim() || "sitemap.xml" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setActionMsg(`✅ Submitted "${submitPath}" to Google Search Console.`);
      void load();
    } catch (err) {
      setActionMsg(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleDelete(path: string) {
    if (!confirm(`Remove "${path}" from GSC?`)) return;
    setActionMsg(null);
    try {
      const res = await fetchWithAuth("/api/admin/gsc/sitemaps", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setActionMsg(`🗑️ Removed "${path}".`);
      void load();
    } catch (err) {
      setActionMsg(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <section className="space-y-6">
      {/* Submit form */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-lg font-semibold">Submit a Sitemap</h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Tell Google where your sitemap lives so it can discover your pages faster. Your site
          already serves{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">/sitemap.xml</code>.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">Sitemap path</label>
            <input
              type="text"
              value={submitPath}
              onChange={(e) => setSubmitPath(e.target.value)}
              placeholder="sitemap.xml"
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Submit to GSC
          </button>
        </form>
        {actionMsg && <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{actionMsg}</p>}
      </div>

      {/* List */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Submitted Sitemaps</h2>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded bg-gray-100 px-3 py-1 text-xs hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">Failed to load: {error}</p>}

        {!loading && !error && sitemaps.length === 0 && (
          <p className="text-sm text-gray-500">No sitemaps submitted yet.</p>
        )}

        {sitemaps.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-800">
                  <th className="py-2 pr-4">Path</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Last Submitted</th>
                  <th className="py-2 pr-4">Last Downloaded</th>
                  <th className="py-2 pr-4">Errors</th>
                  <th className="py-2 pr-4">Warnings</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sitemaps.map((s) => (
                  <tr key={s.path} className="border-b border-gray-100 dark:border-gray-800/50">
                    <td className="py-3 pr-4 font-mono text-xs">{s.path}</td>
                    <td className="py-3 pr-4">
                      {s.isPending ? (
                        <span className="text-yellow-600 dark:text-yellow-400">Pending</span>
                      ) : s.errors ? (
                        <span className="text-red-600 dark:text-red-400">Has errors</span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">Active</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                      {fmtDate(s.lastSubmitted)}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                      {fmtDate(s.lastDownloaded)}
                    </td>
                    <td className="py-3 pr-4 text-red-600 dark:text-red-400">{s.errors ?? "0"}</td>
                    <td className="py-3 pr-4 text-yellow-600 dark:text-yellow-400">
                      {s.warnings ?? "0"}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => void handleDelete(s.path)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── URL Inspection Tab ────────────────────────────────────────────────── */

function InspectTab() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleInspect(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetchWithAuth("/api/admin/gsc/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as InspectionResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const idx = result?.inspectionResult?.indexStatusResult;
  const mobile = result?.inspectionResult?.mobileUsabilityResult;
  const rich = result?.inspectionResult?.richResultsResult;

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-lg font-semibold">Inspect a URL</h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Check whether Google has indexed a specific page, see coverage state, last crawl time, and
          mobile usability — same as the &ldquo;URL Inspection&rdquo; tool in Search Console.
        </p>
        <form onSubmit={handleInspect} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[280px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Full URL (including https://)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://cloudless.gr/blog/some-post"
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Inspecting…" : "Inspect"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Index status */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
              Index Status
              {idx && (
                <span className={verdictColor(idx.verdict)}>
                  {verdictIcon(idx.verdict)} {idx.verdict}
                </span>
              )}
            </h3>
            {idx ? (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Field label="Coverage State" value={idx.coverageState} />
                <Field label="Indexed" value={idx.indexed ? "Yes" : "No"} />
                <Field label="Last Crawled" value={fmtDate(idx.lastCrawlTime)} />
                <Field label="Page Fetch State" value={idx.pageFetchState} />
                <Field label="Robots.txt State" value={idx.robotsTxtState} />
                <Field label="Crawled As" value={idx.crawledAs ?? "—"} />
                <Field label="Google Canonical" value={idx.googleCanonical ?? "—"} mono />
                <Field label="User Canonical" value={idx.userCanonical ?? "—"} mono />
                <Field label="Discovered via sitemap" value={idx.sitemap ?? "—"} mono />
              </dl>
            ) : (
              <p className="text-sm text-gray-500">No index status data returned.</p>
            )}
          </div>

          {/* Mobile usability */}
          {mobile && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                Mobile Usability
                <span className={verdictColor(mobile.verdict)}>
                  {verdictIcon(mobile.verdict)} {mobile.verdict}
                </span>
              </h3>
              {mobile.issues && mobile.issues.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {mobile.issues.map((issue, i) => (
                    <li key={i} className="rounded border border-gray-200 p-3 dark:border-gray-800">
                      <div className="font-medium">{issue.issueType}</div>
                      <div className="text-xs text-gray-500">Severity: {issue.severity}</div>
                      <div className="mt-1 text-gray-700 dark:text-gray-300">{issue.message}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-green-600 dark:text-green-400">
                  No mobile usability issues detected.
                </p>
              )}
            </div>
          )}

          {/* Rich results */}
          {rich && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                Rich Results
                <span className={verdictColor(rich.verdict)}>
                  {verdictIcon(rich.verdict)} {rich.verdict}
                </span>
              </h3>
              {rich.detectedItems && rich.detectedItems.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {rich.detectedItems.map((item, i) => (
                    <li key={i}>
                      <span className="font-medium">{item.richResultType}</span> — {item.items} item
                      {item.items !== 1 ? "s" : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No rich results detected.</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ─── Request Indexing Tab ──────────────────────────────────────────────── */

function IndexTab() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    url: string;
    urlNotificationMetadata?: { latestUpdate?: { type: string; notifyTime: string } };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleIndex(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetchWithAuth("/api/admin/gsc/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as typeof result;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-lg font-semibold">Request Indexing</h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Notify Google that a page has been created or updated so it gets re-crawled sooner. Uses
          the Google Indexing API (separate from Search Console). Best for new blog posts, product
          pages, or recently updated content.
        </p>
        <form onSubmit={handleIndex} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[280px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Full URL to notify
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://cloudless.gr/blog/new-post"
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Notifying…" : "Notify Google"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {result && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-5 dark:border-green-800 dark:bg-green-950/30">
          <h3 className="mb-2 text-base font-semibold text-green-700 dark:text-green-300">
            ✅ Notification Sent
          </h3>
          <dl className="text-sm">
            <Field label="URL" value={result.url} mono />
            <Field
              label="Notification type"
              value={result.urlNotificationMetadata?.latestUpdate?.type ?? "URL_UPDATED"}
            />
            <Field
              label="Notify time"
              value={fmtDate(result.urlNotificationMetadata?.latestUpdate?.notifyTime)}
            />
          </dl>
          <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
            Google will re-crawl this URL typically within hours to a few days.
          </p>
        </div>
      )}
    </section>
  );
}

/* ─── Crawl Errors Tab ──────────────────────────────────────────────────── */

function CrawlTab() {
  const [samples, setSamples] = useState<CrawlStatsSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/gsc/crawl-stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { samples: CrawlStatsSummary[] };
      setSamples(data.samples);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const problemSamples = samples.filter((s) => s.category !== "ok");
  const okSample = samples.find((s) => s.category === "ok");

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Crawl Errors & Issues</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Pages Google tried to crawl but couldn&rsquo;t. Fix these to improve indexation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded bg-gray-100 px-3 py-1 text-xs hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">Failed to load: {error}</p>}

        {!loading && !error && samples.length === 0 && (
          <p className="text-sm text-green-600 dark:text-green-400">
            ✅ No crawl errors detected. Google can reach all sampled pages.
          </p>
        )}

        {/* Summary cards */}
        {samples.length > 0 && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {samples.map((s) => (
              <div
                key={s.category}
                className={`rounded-lg border-2 p-4 ${categoryColor(s.category)}`}
              >
                <div className="text-2xl font-bold">{s.pageCount}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {categoryLabel(s.category)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Problem details */}
        {problemSamples.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Problem URLs (sample)
            </h3>
            {problemSamples.map((cat) => (
              <div
                key={cat.category}
                className={`rounded-lg border p-4 ${categoryColor(cat.category)}`}
              >
                <h4 className="mb-2 text-sm font-semibold">
                  {categoryLabel(cat.category)} ({cat.pageCount})
                </h4>
                <ul className="space-y-1 text-xs">
                  {cat.sampleUrls.map((u, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2">
                      <a
                        href={u.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {u.url}
                      </a>
                      {u.responseState && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          {u.responseState}
                        </span>
                      )}
                      {u.lastCrawlTime && (
                        <span className="text-gray-400">{fmtDate(u.lastCrawlTime)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* OK summary */}
        {okSample && (
          <div className="mt-4 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
            <p className="text-sm text-green-700 dark:text-green-300">
              ✅ {okSample.pageCount} pages crawled successfully in the latest sample.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Shared field component ────────────────────────────────────────────── */

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd
        className={`text-sm text-gray-800 dark:text-gray-200 ${
          mono ? "font-mono text-xs break-all" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
