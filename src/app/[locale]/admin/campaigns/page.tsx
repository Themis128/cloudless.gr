"use client";

import { Link } from "@/i18n/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

const REFRESH_INTERVAL = 30_000;

type PlatformId = "tiktok" | "linkedin" | "x" | "google" | "meta";
type IntegrationId = "tiktok" | "linkedin" | "x" | "google_ads" | "meta";
type ConnectionStatus = "configured" | "not_configured" | "degraded" | "error" | "unknown";

interface PlatformDef {
  id: PlatformId;
  integrationId: IntegrationId;
  href: string;
  name: string;
  description: string;
  color: string;
  badge: string;
  icon: string;
  disabled?: boolean;
}

interface PlatformStats {
  status: ConnectionStatus;
  statusMessage?: string;
  activeCampaigns: number | null;
  impressions: number | null;
  clicks: number | null;
  spend: { amount: number; currency: string } | null;
  error?: string;
}

const platforms: PlatformDef[] = [
  {
    id: "tiktok",
    integrationId: "tiktok",
    href: "/admin/campaigns/tiktok",
    name: "TikTok",
    description: "Video ads, spark ads, TopView",
    color: "border-pink-500/30 bg-pink-500/5 hover:border-pink-500/50",
    badge: "text-pink-400",
    icon: "♪",
  },
  {
    id: "linkedin",
    integrationId: "linkedin",
    href: "/admin/campaigns/linkedin",
    name: "LinkedIn",
    description: "Sponsored content, lead gen, InMail",
    color: "border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50",
    badge: "text-blue-400",
    icon: "in",
  },
  {
    id: "x",
    integrationId: "x",
    href: "/admin/campaigns/x",
    name: "X (Twitter)",
    description: "Promoted posts, follower campaigns",
    color: "border-slate-500/30 bg-slate-500/5 hover:border-slate-500/50",
    badge: "text-slate-300",
    icon: "𝕏",
  },
  {
    id: "google",
    integrationId: "google_ads",
    href: "/admin/campaigns/google",
    name: "Google Ads",
    description: "Search, display, Performance Max",
    color: "border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50",
    badge: "text-yellow-400",
    icon: "G",
  },
  {
    id: "meta",
    integrationId: "meta",
    href: "/admin/campaigns/meta",
    name: "Meta",
    description: "Facebook + Instagram ads & insights",
    color: "border-blue-600/30 bg-blue-600/5 hover:border-blue-600/50",
    badge: "text-blue-400",
    icon: "f",
  },
];

const STATUS_DOT_CLASS: Record<ConnectionStatus, string> = {
  configured: "bg-neon-green",
  degraded: "bg-yellow-400",
  not_configured: "bg-slate-600",
  error: "bg-red-500",
  unknown: "bg-slate-700",
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  configured: "Connected",
  degraded: "Partial",
  not_configured: "Not configured",
  error: "Error",
  unknown: "—",
};

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-IE").format(Math.round(n));
}

function formatMoney(amount: number, currency: string): string {
  if (currency === "USD" || currency === "EUR") {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return `${formatNumber(amount)} ${currency}`;
}

function emptyStats(status: ConnectionStatus = "unknown"): PlatformStats {
  return {
    status,
    activeCampaigns: null,
    impressions: null,
    clicks: null,
    spend: null,
  };
}

function pickCount<T>(data: unknown, key: string): T[] {
  if (data && typeof data === "object" && key in data) {
    const list = (data as Record<string, unknown>)[key];
    if (Array.isArray(list)) return list as T[];
  }
  return [];
}

interface ActiveLike {
  status?: string;
}

function countActive(list: ActiveLike[]): number {
  return list.filter((c) => {
    const s = (c.status ?? "").toUpperCase();
    return s === "ACTIVE" || s === "ENABLED";
  }).length;
}

async function fetchStatusMap(): Promise<
  Partial<Record<IntegrationId, { status: ConnectionStatus; message?: string }>>
> {
  try {
    const res = await fetchWithAuth("/api/admin/integrations/status");
    if (!res.ok) return {};
    const data = (((((await res.json()) as any)) as any)) as {
      integrations?: Array<{
        id: string;
        status: ConnectionStatus;
        message?: string;
      }>;
    };
    const map: Partial<Record<IntegrationId, { status: ConnectionStatus; message?: string }>> = {};
    for (const i of data.integrations ?? []) {
      map[i.id as IntegrationId] = { status: i.status, message: i.message };
    }
    return map;
  } catch {
    return {};
  }
}

async function fetchPlatformStats(
  platform: PlatformDef,
  start: string,
  end: string
): Promise<PlatformStats> {
  const stats = emptyStats();

  const [campaignsRes, insightsRes] = await Promise.allSettled([
    fetchWithAuth(`/api/admin/campaigns/${platform.id}`),
    fetchWithAuth(`/api/admin/campaigns/${platform.id}/insights?start=${start}&end=${end}`),
  ]);

  if (campaignsRes.status === "fulfilled" && campaignsRes.value.ok) {
    try {
      const data = (((((await campaignsRes.value.json()) as any)) as any)) as any;
      stats.activeCampaigns = countActive(pickCount(data, "campaigns"));
    } catch {
      stats.error = "Failed to parse campaigns";
    }
  }

  if (insightsRes.status === "fulfilled" && insightsRes.value.ok) {
    try {
      const data = (((((await insightsRes.value.json()) as any)) as any)) as any;
      applyInsights(platform.id, data, stats);
    } catch {
      stats.error = "Failed to parse insights";
    }
  }

  return stats;
}

function applyInsights(id: PlatformId, data: unknown, stats: PlatformStats): void {
  if (!data || typeof data !== "object") return;
  const root = data as Record<string, unknown>;

  if (id === "google") {
    const m = root.metrics as
      { impressions?: number; clicks?: number; costMicros?: number } | undefined;
    if (m) {
      stats.impressions = m.impressions ?? 0;
      stats.clicks = m.clicks ?? 0;
      stats.spend = {
        amount: (m.costMicros ?? 0) / 1_000_000,
        currency: "EUR",
      };
    }
  } else if (id === "linkedin") {
    const i = root.insights as
      | {
          impressions?: number;
          clicks?: number;
          costInLocalCurrency?: string;
        }
      | undefined;
    if (i) {
      stats.impressions = i.impressions ?? 0;
      stats.clicks = i.clicks ?? 0;
      stats.spend = {
        amount: Number.parseFloat(i.costInLocalCurrency ?? "0") || 0,
        currency: "EUR",
      };
    }
  } else if (id === "tiktok") {
    const i = root.insights as
      { impressions?: string; clicks?: string; spend?: string } | undefined;
    if (i) {
      stats.impressions = Number.parseInt(i.impressions ?? "0", 10) || 0;
      stats.clicks = Number.parseInt(i.clicks ?? "0", 10) || 0;
      stats.spend = {
        amount: Number.parseFloat(i.spend ?? "0") || 0,
        currency: "USD",
      };
    }
  } else if (id === "x") {
    const s = root.stats as
      { impressions?: number; clicks?: number; spend_micro?: number } | undefined;
    if (s) {
      stats.impressions = s.impressions ?? 0;
      stats.clicks = s.clicks ?? 0;
      stats.spend = {
        amount: (s.spend_micro ?? 0) / 1_000_000,
        currency: "USD",
      };
    }
  }
}

interface HubData {
  stats: Record<PlatformId, PlatformStats>;
  fetchedAt: string;
}

const INITIAL_HUB: HubData = {
  stats: {
    tiktok: emptyStats(),
    linkedin: emptyStats(),
    x: emptyStats(),
    google: emptyStats(),
    meta: emptyStats(),
  },
  fetchedAt: "",
};

function useCampaignsHub() {
  const [hub, setHub] = useState<HubData>(INITIAL_HUB);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const start = firstOfMonth();
      const end = todayIso();
      const statusMap = await fetchStatusMap();

      const entries = await Promise.all(
        platforms.map(async (p) => {
          const conn = statusMap[p.integrationId];
          if (p.disabled || conn?.status !== "configured") {
            return [
              p.id,
              {
                ...emptyStats(conn?.status ?? "unknown"),
                statusMessage: conn?.message,
              },
            ] as const;
          }
          const s = await fetchPlatformStats(p, start, end);
          s.status = conn.status;
          s.statusMessage = conn.message;
          return [p.id, s] as const;
        })
      );

      const stats = Object.fromEntries(entries) as Record<PlatformId, PlatformStats>;
      setHub({ stats, fetchedAt: new Date().toISOString() });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
     
    fetchAll().catch(() => {});
    const interval = setInterval(() => {
      fetchAll().catch(() => {});
    }, REFRESH_INTERVAL);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchAll().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchAll]);

  return { hub, loading, refreshing, error, refresh: () => fetchAll(true) };
}

export default function CampaignsDashboard() {
  const { hub, loading, refreshing, error, refresh } = useCampaignsHub();

  const totals = computeTotals(hub.stats);

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="border-neon-magenta/20 bg-neon-magenta/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-magenta font-mono text-xs">CAMPAIGNS</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">Campaign Manager</h1>
          <p className="font-body mt-1 text-slate-400">
            Manage paid campaigns across all advertising platforms.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 rounded-lg border px-3 py-1.5 font-mono text-xs disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          {hub.fetchedAt && (
            <p className="font-mono text-[10px] text-slate-600">
              Updated {new Date(hub.fetchedAt).toLocaleTimeString("en-IE")}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 p-3 font-mono text-xs text-red-400">
          {error}
        </div>
      )}

      <TotalsStrip totals={totals} loading={loading} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {platforms.map((p) => {
          const stats = hub.stats[p.id];
          const card = <PlatformCard platform={p} stats={stats} loading={loading} />;
          return p.disabled ? (
            <div key={p.href} className={`rounded-xl border p-5 transition-all ${p.color}`}>
              {card}
            </div>
          ) : (
            <Link
              key={p.href}
              href={p.href}
              className={`rounded-xl border p-5 transition-all ${p.color}`}
            >
              {card}
            </Link>
          );
        })}
      </div>

      <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/20 p-5">
        <h2 className="font-heading mb-2 font-semibold text-white">Quick Links</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/calendar"
            className="font-mono text-xs text-slate-400 transition-colors hover:text-white"
          >
            Content Calendar →
          </Link>
          <Link
            href="/admin/reports"
            className="font-mono text-xs text-slate-400 transition-colors hover:text-white"
          >
            Reports →
          </Link>
          <Link
            href="/admin/ai-assistant"
            className="font-mono text-xs text-slate-400 transition-colors hover:text-white"
          >
            AI Campaign Assistant →
          </Link>
        </div>
      </div>
    </div>
  );
}

interface Totals {
  connected: number;
  totalPlatforms: number;
  activeCampaigns: number;
  impressions: number;
  clicks: number;
}

function computeTotals(stats: Record<PlatformId, PlatformStats>): Totals {
  const totalPlatforms = platforms.filter((p) => !p.disabled).length;
  let connected = 0;
  let activeCampaigns = 0;
  let impressions = 0;
  let clicks = 0;
  for (const p of platforms) {
    if (p.disabled) continue;
    const s = stats[p.id];
    if (s.status === "configured") connected++;
    if (s.activeCampaigns !== null) activeCampaigns += s.activeCampaigns;
    if (s.impressions !== null) impressions += s.impressions;
    if (s.clicks !== null) clicks += s.clicks;
  }
  return { connected, totalPlatforms, activeCampaigns, impressions, clicks };
}

function TotalsStrip({ totals, loading }: { readonly totals: Totals; readonly loading: boolean }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile
        label="Connected"
        value={`${totals.connected} / ${totals.totalPlatforms}`}
        loading={loading}
      />
      <Tile
        label="Active campaigns"
        value={formatNumber(totals.activeCampaigns)}
        loading={loading}
      />
      <Tile label="Impressions (MTD)" value={formatNumber(totals.impressions)} loading={loading} />
      <Tile label="Clicks (MTD)" value={formatNumber(totals.clicks)} loading={loading} />
    </div>
  );
}

function Tile({
  label,
  value,
  loading,
}: {
  readonly label: string;
  readonly value: string;
  readonly loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4">
      <p className="font-mono text-[10px] tracking-widest text-slate-600 uppercase">{label}</p>
      {loading ? (
        <div className="mt-2 h-6 w-16 animate-pulse rounded bg-slate-800/60" />
      ) : (
        <p className="font-heading mt-1 text-xl font-bold text-white">{value}</p>
      )}
    </div>
  );
}

function PlatformCard({
  platform,
  stats,
  loading,
}: {
  readonly platform: PlatformDef;
  readonly stats: PlatformStats;
  readonly loading: boolean;
}) {
  const showKpis = !platform.disabled && stats.status === "configured" && !loading;
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`font-mono text-lg font-bold ${platform.badge}`}>{platform.icon}</span>
          <div>
            <p className={`font-mono text-sm font-semibold ${platform.badge}`}>{platform.name}</p>
            {platform.disabled && (
              <span className="rounded-full border border-yellow-900/30 bg-yellow-950/20 px-2 py-0.5 font-mono text-[9px] text-yellow-600">
                PENDING
              </span>
            )}
          </div>
        </div>
        <div
          className="flex items-center gap-1.5"
          title={stats.statusMessage ?? STATUS_LABEL[stats.status]}
        >
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS[stats.status]}`} />
          <span className="font-mono text-[9px] tracking-wider text-slate-500 uppercase">
            {STATUS_LABEL[stats.status]}
          </span>
        </div>
      </div>

      <p className="font-mono text-xs text-slate-500">{platform.description}</p>

      {showKpis ? (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-800/60 pt-3">
          <Kpi
            label="Active"
            value={stats.activeCampaigns === null ? "—" : formatNumber(stats.activeCampaigns)}
          />
          <Kpi
            label="Spend MTD"
            value={stats.spend ? formatMoney(stats.spend.amount, stats.spend.currency) : "—"}
          />
          <Kpi
            label="Impressions"
            value={stats.impressions === null ? "—" : formatNumber(stats.impressions)}
          />
          <Kpi label="Clicks" value={stats.clicks === null ? "—" : formatNumber(stats.clicks)} />
        </div>
      ) : null}
      {loading && !platform.disabled && (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-800/60 pt-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-2 w-12 rounded bg-slate-800/60" />
              <div className="h-4 w-16 animate-pulse rounded bg-slate-800/60" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Kpi({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] tracking-wider text-slate-600 uppercase">{label}</p>
      <p className="font-mono text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
