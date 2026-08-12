"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useState } from "react";

interface AuditEntry {
  name: string;
  workflow: string;
  ok: boolean | null;
  lastRun: { id: number; sha: string; url: string; at: string } | null;
  summary: unknown;
  note: string | null;
}

interface Dashboard {
  generatedAt: string;
  repo: string;
  audits: Record<string, AuditEntry>;
}

function statusBadge(ok: boolean | null): { icon: string; color: string; label: string } {
  if (ok === true)
    return { icon: "✅", color: "text-green-600 dark:text-green-400", label: "passing" };
  if (ok === false)
    return { icon: "❌", color: "text-red-600 dark:text-red-400", label: "failing" };
  return { icon: "⚪", color: "text-gray-500 dark:text-gray-400", label: "unknown" };
}

function relativeAge(iso: string | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AuditsPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/audits/latest");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as Dashboard;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // react-hooks/set-state-in-effect: do not call setState synchronously in
    // the effect body. Defer the load to the next microtask so React's
    // commit-phase invariant is satisfied.
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-3xl font-bold">Audits</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Rolling dashboard of every audit workflow. Updated nightly at 06:00 UTC.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <p className="text-red-700 dark:text-red-300">Failed to load audit dashboard: {error}</p>
        </div>
      )}

      {data && (
        <>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Generated{" "}
            {new Date(data.generatedAt).toLocaleString(undefined, { timeZone: "Europe/Athens" })} ·{" "}
            {data.repo}
          </p>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(data.audits).map(([key, entry]) => {
              const badge = statusBadge(entry.ok);
              return (
                <article
                  key={key}
                  className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
                >
                  <header className="mb-3 flex items-start justify-between">
                    <h2 className="font-semibold">
                      {entry.lastRun?.url ? (
                        <a
                          href={entry.lastRun.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {entry.name}
                        </a>
                      ) : (
                        entry.name
                      )}
                    </h2>
                    <span
                      className={`text-2xl ${badge.color}`}
                      title={badge.label}
                      aria-label={badge.label}
                    >
                      {badge.icon}
                    </span>
                  </header>
                  <dl className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <dt>Workflow</dt>
                      <dd className="font-mono text-xs">{entry.workflow}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Last run</dt>
                      <dd>{relativeAge(entry.lastRun?.at)}</dd>
                    </div>
                    {entry.lastRun?.sha && (
                      <div className="flex justify-between">
                        <dt>Commit</dt>
                        <dd className="font-mono text-xs">{entry.lastRun.sha}</dd>
                      </div>
                    )}
                    {entry.note && (
                      <div className="pt-2 text-xs text-gray-500 italic dark:text-gray-500">
                        {entry.note}
                      </div>
                    )}
                  </dl>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
