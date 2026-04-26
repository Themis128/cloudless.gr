"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";

type IntegrationStatus = "configured" | "not_configured" | "degraded" | "error";

interface ApiIntegration {
  id: string;
  status: IntegrationStatus;
  message?: string;
}

interface ApiResponse {
  integrations: ApiIntegration[];
  summary: {
    total: number;
    configured: number;
    degraded: number;
    not_configured: number;
    error: number;
  };
  checkedAt: string;
}

interface IntegrationDef {
  id: string;
  name: string;
  category: string;
  setupUrl: string;
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "ses",
    name: "AWS SES",
    category: "Email",
    setupUrl: "https://console.aws.amazon.com/ses",
  },
  {
    id: "cognito",
    name: "AWS Cognito",
    category: "Auth",
    setupUrl: "https://console.aws.amazon.com/cognito",
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "Payments",
    setupUrl: "https://dashboard.stripe.com/apikeys",
  },
  {
    id: "hubspot",
    name: "HubSpot CRM",
    category: "CRM",
    setupUrl: "https://app.hubspot.com/private-apps",
  },
  {
    id: "slack",
    name: "Slack",
    category: "Communication",
    setupUrl: "https://api.slack.com/apps",
  },
  {
    id: "notion",
    name: "Notion",
    category: "Content",
    setupUrl: "https://www.notion.so/my-integrations",
  },
  {
    id: "google",
    name: "Google (Calendar + Search Console)",
    category: "Analytics",
    setupUrl: "https://console.cloud.google.com/iam-admin/serviceaccounts",
  },
  {
    id: "sentry",
    name: "Sentry",
    category: "Monitoring",
    setupUrl: "https://sentry.io/settings/auth-tokens/",
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude AI)",
    category: "AI",
    setupUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "activecampaign",
    name: "ActiveCampaign",
    category: "Email",
    setupUrl: "https://www.activecampaign.com",
  },
  {
    id: "meta",
    name: "Meta (Facebook/Instagram)",
    category: "Ads",
    setupUrl: "https://business.facebook.com/settings/system-users",
  },
  {
    id: "linkedin",
    name: "LinkedIn Ads",
    category: "Ads",
    setupUrl: "https://www.linkedin.com/campaignmanager",
  },
  {
    id: "tiktok",
    name: "TikTok Ads",
    category: "Ads",
    setupUrl: "https://ads.tiktok.com/marketing_api/apps",
  },
  {
    id: "x",
    name: "X (Twitter) Ads",
    category: "Ads",
    setupUrl: "https://ads.x.com/help",
  },
  {
    id: "google_ads",
    name: "Google Ads",
    category: "Ads",
    setupUrl: "https://ads.google.com/intl/en_us/home/tools/api-center/",
  },
];

const CATEGORY_ORDER = [
  "Email",
  "CRM",
  "Ads",
  "Analytics",
  "Monitoring",
  "Payments",
  "Communication",
  "Content",
  "Auth",
  "AI",
];

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

type StatusMap = Map<string, { status: IntegrationStatus; message?: string }>;

function groupByCategory(): Record<string, IntegrationDef[]> {
  const map: Record<string, IntegrationDef[]> = {};
  for (const item of INTEGRATIONS) {
    (map[item.category] ??= []).push(item);
  }
  return map;
}

function sortedCategories(map: Record<string, IntegrationDef[]>): string[] {
  const known = CATEGORY_ORDER.filter((c) => map[c]);
  const rest = Object.keys(map).filter((c) => !CATEGORY_ORDER.includes(c));
  return [...known, ...rest];
}

const grouped = groupByCategory();
const categories = sortedCategories(grouped);

export default function IntegrationsPage() {
  const [statusMap, setStatusMap] = useState<StatusMap>(new Map());
  const [summary, setSummary] = useState<ApiResponse["summary"] | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchStatus() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithAuth("/api/admin/integrations/status");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: ApiResponse = await res.json();
        if (!cancelled) {
          const map: StatusMap = new Map(
            data.integrations.map((i) => [
              i.id,
              { status: i.status, message: i.message },
            ]),
          );
          setStatusMap(map);
          setSummary(data.summary);
          setCheckedAt(data.checkedAt);
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

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
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="mt-2 rounded-lg border border-slate-700 px-4 py-2 font-mono text-xs text-slate-300 transition-all hover:border-slate-600 hover:text-white disabled:opacity-50"
        >
          {loading ? "Checking…" : "Refresh"}
        </button>
      </div>

      {/* Summary bar */}
      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Configured", summary.configured, "text-neon-green"],
              ["Degraded", summary.degraded, "text-yellow-400"],
              ["Not set up", summary.not_configured, "text-slate-500"],
              ["Error", summary.error, "text-red-400"],
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

      {loading && statusMap.size === 0 && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-void-light/50 h-32 animate-pulse rounded-xl border border-slate-800"
            />
          ))}
        </div>
      )}

      {/* Integration groups — iterates over static INTEGRATIONS, status looked up by id */}
      <div className="space-y-6">
        {categories.map((category) => (
          <div key={category}>
            <h2 className="font-heading mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500">
              {category}
            </h2>
            <div className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
              {grouped[category].map((integration) => {
                const info = statusMap.get(integration.id);
                const status: IntegrationStatus =
                  info?.status ?? "not_configured";
                return (
                  <div
                    key={integration.id}
                    className="bg-void-light/50 flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${STATUS_DOT[status]}`}
                      />
                      <span className="font-heading truncate font-medium text-white">
                        {integration.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 pl-5 sm:pl-0">
                      {info?.message && (
                        <span className="font-mono text-xs text-slate-500">
                          {info.message}
                        </span>
                      )}
                      <span
                        className={`flex-shrink-0 font-mono text-xs ${STATUS_TEXT[status]}`}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                      {status !== "configured" && (
                        <a
                          href={integration.setupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 rounded-lg border border-slate-700 px-3 py-1 font-mono text-xs text-slate-300 transition-all hover:border-neon-magenta/50 hover:text-white"
                        >
                          Connect
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {checkedAt && (
        <p className="mt-6 font-mono text-xs text-slate-600">
          Last checked:{" "}
          {new Date(checkedAt).toLocaleTimeString("en-IE", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
