"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────

interface DbStatus {
  name: string;
  configured: boolean;
  connected: boolean;
  count: number;
  sample: Record<string, unknown>[];
  error?: string;
}

interface StatusResponse {
  authenticated: boolean;
  botName?: string;
  error?: string;
  databases: DbStatus[];
}

// ── Helpers ──────────────────────────────────────────────────

const DB_ICONS: Record<string, string> = {
  Blog: "\u{1F4DD}",
  Docs: "\u{1F4DA}",
  Projects: "\u{1F3D7}",
  Tasks: "\u2705",
  Submissions: "\u{1F4EC}",
  Analytics: "\u{1F4CA}",
};

const DB_LINKS: Record<string, string> = {
  Blog: "/admin/blog",
  Docs: "/docs",
  Projects: "/admin/appflowy/projects",
  Tasks: "/admin/appflowy/tasks",
  Submissions: "/admin/appflowy",
  Analytics: "/admin/appflowy/analytics",
};

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
        ok
          ? "bg-neon-green/10 text-neon-green border-neon-green/30"
          : "border-red-500/30 bg-red-500/10 text-red-400"
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? "bg-neon-green" : "bg-red-500"}`}
      />
      {label}
    </span>
  );
}

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "")
    return <span className="text-slate-600">{"\u2014"}</span>;
  if (typeof value === "boolean")
    return (
      <span className={value ? "text-neon-green" : "text-slate-500"}>
        {value ? "\u2714" : "\u2718"}
      </span>
    );
  if (Array.isArray(value))
    return (
      <span className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span key={i} className="rounded bg-slate-700/50 px-1.5 py-0.5 text-xs text-slate-300">
            {String(v)}
          </span>
        ))}
      </span>
    );
  const str = String(value);
  return (
    <span className="inline-block max-w-[200px] truncate align-bottom" title={str}>
      {str.length > 60 ? str.slice(0, 57) + "..." : str}
    </span>
  );
}

// ── Database Card ────────────────────────────────────────────

function DatabaseCard({
  db,
  expanded,
  onToggle,
}: {
  db: DbStatus;
  expanded: boolean;
  onToggle: () => void;
}) {
  const icon = DB_ICONS[db.name] ?? "\u{1F4CB}";

  // Get column headers from first sample row
  const columns = db.sample.length > 0 ? Object.keys(db.sample[0]).filter((k) => k !== "id") : [];

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700/50 bg-slate-800/40">
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-slate-700/20"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <h3 className="text-lg font-semibold text-white">{db.name}</h3>
          {db.configured ? (
            db.connected ? (
              <StatusBadge ok={true} label="Connected" />
            ) : (
              <StatusBadge ok={false} label="Error" />
            )
          ) : (
            <StatusBadge ok={false} label="Not Configured" />
          )}
          {db.connected && (
            <span className="text-sm text-slate-400">
              {db.count} row{db.count !== 1 ? "s" : ""} loaded
            </span>
          )}
        </div>
        <span className={`text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}>
          {"\u25BC"}
        </span>
      </button>

      {/* Error */}
      {db.error && (
        <div className="px-5 pb-3">
          <div className="rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {db.error}
          </div>
        </div>
      )}

      {/* Not configured hint */}
      {!db.configured && expanded && (
        <div className="px-5 pb-4">
          <div className="rounded border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
            Set{" "}
            <code className="rounded bg-slate-700 px-1">APPFLOWY_{db.name.toUpperCase()}_DB</code>{" "}
            in <code className="rounded bg-slate-700 px-1">.env.local</code> and share the database
            with your integration.
          </div>
        </div>
      )}

      {/* Data table */}
      {expanded && db.connected && db.sample.length > 0 && (
        <div className="overflow-x-auto px-5 pb-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="border-b border-slate-700/50 px-2 py-1.5 text-left text-xs font-medium tracking-wider text-slate-400 uppercase"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {db.sample.map((row, i) => (
                <tr
                  key={String(row.id ?? i)}
                  className="border-b border-slate-700/30 hover:bg-slate-700/10"
                >
                  {columns.map((col) => (
                    <td key={col} className="px-2 py-2 text-slate-300">
                      <CellValue value={row[col]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {db.count >= 5 && (
            <p className="mt-2 text-xs text-slate-500">
              Showing first 5 rows.{" "}
              <a href={DB_LINKS[db.name] ?? "#"} className="text-neon-cyan hover:underline">
                View all {"\u2192"}
              </a>
            </p>
          )}
        </div>
      )}

      {expanded && db.connected && db.sample.length === 0 && (
        <div className="px-5 pb-4">
          <p className="text-sm text-slate-500 italic">Database is empty {"\u2014"} no rows yet.</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function AppFlowyStatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDbs, setExpandedDbs] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/appflowy/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: StatusResponse = ((((await res.json()) as any)) as any);
      setData(json);
      // Auto-expand connected databases
      const connected = new Set(json.databases.filter((d) => d.connected).map((d) => d.name));
      setExpandedDbs(connected);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
     
    load();
  }, [load]);

  const toggleDb = (name: string) => {
    setExpandedDbs((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const connectedCount = data?.databases.filter((d) => d.connected).length ?? 0;
  const configuredCount = data?.databases.filter((d) => d.configured).length ?? 0;
  const totalDbs = data?.databases.length ?? 0;

  return (
    <div className="bg-bg-void min-h-screen text-white">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="from-neon-cyan to-neon-magenta bg-gradient-to-r bg-clip-text text-3xl font-bold text-transparent">
            AppFlowy Integration Status
          </h1>
          <p className="mt-2 text-slate-400">
            Live connection status and content preview for all AppFlowy databases.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="border-neon-cyan h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
            <span className="ml-3 text-slate-400">Connecting to AppFlowy...</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
            {error}
            <button onClick={load} className="ml-3 underline hover:text-red-300">
              Retry
            </button>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Auth status */}
            <div className="mb-6 rounded-lg border border-slate-700/50 bg-slate-800/40 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{"\u{1F512}"}</span>
                  <span className="font-medium text-white">Authentication</span>
                  {data.authenticated ? (
                    <StatusBadge ok={true} label={`Connected as ${data.botName}`} />
                  ) : (
                    <StatusBadge ok={false} label="Not Authenticated" />
                  )}
                </div>
                <button
                  onClick={load}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700/50"
                >
                  {"\u21BB"} Refresh
                </button>
              </div>
              {!data.authenticated && data.error && (
                <p className="mt-2 text-sm text-red-400">{data.error}</p>
              )}
            </div>

            {/* Summary cards */}
            {data.authenticated && (
              <div className="mb-6 grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-3 text-center">
                  <div className="text-neon-cyan text-2xl font-bold">{totalDbs}</div>
                  <div className="text-xs tracking-wider text-slate-400 uppercase">Databases</div>
                </div>
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-3 text-center">
                  <div className="text-neon-green text-2xl font-bold">{configuredCount}</div>
                  <div className="text-xs tracking-wider text-slate-400 uppercase">Configured</div>
                </div>
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-3 text-center">
                  <div
                    className={`text-2xl font-bold ${connectedCount === totalDbs ? "text-neon-green" : "text-yellow-400"}`}
                  >
                    {connectedCount}
                  </div>
                  <div className="text-xs tracking-wider text-slate-400 uppercase">Connected</div>
                </div>
              </div>
            )}

            {/* Database cards */}
            {data.authenticated && (
              <div className="space-y-3">
                {data.databases.map((db) => (
                  <DatabaseCard
                    key={db.name}
                    db={db}
                    expanded={expandedDbs.has(db.name)}
                    onToggle={() => toggleDb(db.name)}
                  />
                ))}
              </div>
            )}

            {/* Setup instructions when not authenticated */}
            {!data.authenticated && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-5 py-4">
                <h2 className="mb-3 text-lg font-semibold text-yellow-400">Setup Instructions</h2>
                <ol className="space-y-2 text-sm text-slate-300">
                  <li>
                    <span className="text-neon-cyan mr-2 font-mono">1.</span>
                    Go to{" "}
                    <a
                      href="https://www.appflowy.cloudless.gr"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neon-cyan hover:underline"
                    >
                      appflowy.cloudless.gr
                    </a>{" "}
                    and create an Internal Integration
                  </li>
                  <li>
                    <span className="text-neon-cyan mr-2 font-mono">2.</span>
                    Copy the secret token
                  </li>
                  <li>
                    <span className="text-neon-cyan mr-2 font-mono">3.</span>
                    Open{" "}
                    <code className="rounded bg-slate-700 px-1.5 py-0.5 text-xs">
                      .env.local
                    </code>{" "}
                    and set{" "}
                    <code className="rounded bg-slate-700 px-1.5 py-0.5 text-xs">
                      APPFLOWY_API_URL + APPFLOWY_JWT_SECRET in SSM
                    </code>
                  </li>
                  <li>
                    <span className="text-neon-cyan mr-2 font-mono">4.</span>
                    In AppFlowy, the databases are auto-synced {"\u2192"} <strong>...</strong>{" "}
                    {"\u2192"} <strong>Connections</strong> {"\u2192"} add your integration
                  </li>
                  <li>
                    <span className="text-neon-cyan mr-2 font-mono">5.</span>
                    Restart the dev server and refresh this page
                  </li>
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
