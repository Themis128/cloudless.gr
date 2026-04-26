"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";

type IntegrationStatus = "configured" | "not_configured" | "degraded" | "error";

interface IntegrationReport {
  id: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  message?: string;
  setupUrl?: string;
}

interface StatusResponse {
  integrations: IntegrationReport[];
  summary: {
    total: number;
    configured: number;
    degraded: number;
    not_configured: number;
    error: number;
  };
  checkedAt: string;
}

const STATUS_DOT: Record<IntegrationStatus, string> = {
  configured: "bg-neon-green",
  degraded: "bg-yellow-400",
  not_configured: "bg-slate-600",
  error: "bg-red-500",
};

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  configured: "Configured",
  degraded: "Degraded",
  not_configured: "Not configured",
  error: "Error",
};

const STATUS_TEXT: Record<IntegrationStatus, string> = {
  configured: "text-neon-green",
  degraded: "text-yellow-400",
  not_configured: "text-slate-500",
  error: "text-red-400",
};

const CATEGORY_ORDER = [
  "Email",
  "CRM",
  "Ads",
  "Analytics",
  "Monitoring",
  "Payments",
  "Communication",
  "Content",
  "AI",
];

function groupByCategory(
  items: IntegrationReport[],
): Record<string, IntegrationReport[]> {
  const map: Record<string, IntegrationReport[]> = {};
  for (const item of items) {
    (map[item.category] ??= []).push(item);
  }
  return map;
}

function sortedCategories(map: Record<string, IntegrationReport[]>): string[] {
  const known = CATEGORY_ORDER.filter((c) => map[c]);
  const rest = Object.keys(map).filter((c) => !CATEGORY_ORDER.includes(c));
  return [...known, ...rest];
}

export default function IntegrationsPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/integrations/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = data ? groupByCategory(data.integrations) : {};
  const categories = sortedCategories(grouped);

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-magenta font-mono text-xs">
              INTEGRATIONS
            </span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">
            Integrations
          </h1>
          <p className="font-body mt-1 text-slate-400">
            Live status of all external services connected to Cloudless.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="mt-2 rounded-lg border border-slate-700 px-4 py-2 font-mono text-xs text-slate-300 transition-all hover:border-slate-600 hover:text-white disabled:opacity-50"
        >
          {loading ? "Checking…" : "Refresh"}
        </button>
      </div>

      {/* Summary bar */}
      {data && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Configured", data.summary.configured, "text-neon-green"],
              ["Degraded", data.summary.degraded, "text-yellow-400"],
              ["Not set up", data.summary.not_configured, "text-slate-500"],
              ["Error", data.summary.error, "text-red-400"],
            ] as const
          ).map(([label, count, cls]) => (
            <div
              key={label}
              className="bg-void-light/50 rounded-xl border border-slate-800 px-4 py-3"
            >
              <div className={`font-mono text-xl font-bold ${cls}`}>
                {count}
              </div>
              <div className="font-mono text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-xs text-red-400">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-void-light/50 h-32 animate-pulse rounded-xl border border-slate-800"
            />
          ))}
        </div>
      )}

      {/* Integration groups */}
      <div className="space-y-6">
        {categories.map((category) => (
          <div key={category}>
            <h2 className="font-heading mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500">
              {category}
            </h2>
            <div className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
              {grouped[category].map((integration) => (
                <div
                  key={integration.id}
                  className="bg-void-light/50 flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${STATUS_DOT[integration.status]}`}
                    />
                    <span className="font-heading truncate font-medium text-white">
                      {integration.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pl-5 sm:pl-0">
                    {integration.message && (
                      <span className="font-mono text-xs text-slate-500">
                        {integration.message}
                      </span>
                    )}
                    <span
                      className={`flex-shrink-0 font-mono text-xs ${STATUS_TEXT[integration.status]}`}
                    >
                      {STATUS_LABEL[integration.status]}
                    </span>
                    {integration.setupUrl &&
                      integration.status !== "configured" && (
                        <a
                          href={integration.setupUrl}
                          className="flex-shrink-0 rounded-lg border border-slate-700 px-3 py-1 font-mono text-xs text-slate-300 transition-all hover:border-neon-magenta/50 hover:text-white"
                        >
                          Connect
                        </a>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {data && (
        <p className="mt-6 font-mono text-xs text-slate-600">
          Last checked:{" "}
          {new Date(data.checkedAt).toLocaleTimeString("en-IE", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
