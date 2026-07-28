"use client";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
type AppKey = "appflowy" | "espocrm" | "n8n" | "postiz" | "grafana" | "kuma";
type AuthMode = "auto" | "link" | "vpn";
type HealthStatus = "up" | "down" | "pending" | "unknown";
interface AppDef {
  key: AppKey;
  name: string;
  description: string;
  icon: string;
  authMode: AuthMode;
  detail: string;
}
interface KumaMonitor {
  id: number;
  name: string;
  status: "up" | "down" | "pending";
  pingMs: number | null;
  lastHeartbeatAt: string | null;
  groupName: string;
}
interface KumaSummary {
  monitors: KumaMonitor[];
}
const APPS: AppDef[] = [
  {
    key: "espocrm",
    name: "EspoCRM",
    description: "CRM · Leads · Contacts · Deals",
    icon: "◉",
    authMode: "link",
    detail: "Manage leads, contacts, and deal pipeline",
  },
  {
    key: "appflowy",
    name: "AppFlowy",
    description: "Notes · Docs · Wiki",
    icon: "📝",
    authMode: "auto",
    detail: "Auto-login via GoTrue token",
  },
  {
    key: "n8n",
    name: "n8n",
    description: "Workflow automation",
    icon: "🔀",
    authMode: "link",
    detail: "Trigger and inspect workflows",
  },
  {
    key: "postiz",
    name: "Postiz",
    description: "Social publishing",
    icon: "📨",
    authMode: "link",
    detail: "Schedule and review posts",
  },
  {
    key: "grafana",
    name: "Grafana",
    description: "Dashboards · Metrics",
    icon: "📊",
    authMode: "vpn",
    detail: "Requires VPN / Tailscale",
  },
  {
    key: "kuma",
    name: "Uptime Kuma",
    description: "Uptime · Status",
    icon: "🟢",
    authMode: "link",
    detail: "Monitor status and alerts",
  },
];
const AUTH_BADGE: Record<AuthMode, { label: string; klass: string }> = {
  auto: { label: "AUTO-LOGIN", klass: "border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan" },
  link: { label: "DIRECT LINK", klass: "border-slate-700 bg-slate-800/50 text-slate-400" },
  vpn: { label: "VPN ONLY", klass: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" },
};
function HealthBadge({ status, pingMs }: { status: HealthStatus; pingMs?: number | null }) {
  if (status === "unknown") return null;
  const cfg = {
    up: { dot: "bg-neon-green", klass: "text-neon-green", label: "UP" },
    down: { dot: "bg-red-400 animate-pulse", klass: "text-red-400", label: "DOWN" },
    pending: { dot: "bg-slate-500", klass: "text-slate-500", label: "PENDING" },
  }[status];
  return (
    <div className="flex items-center gap-1.5">
      {" "}
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />{" "}
      <span className={`font-mono text-[10px] ${cfg.klass}`}>
        {" "}
        {cfg.label} {status === "up" && pingMs != null ? ` · ${pingMs}ms` : ""}{" "}
      </span>{" "}
    </div>
  );
}
interface AppCardProps {
  app: AppDef;
  health: HealthStatus;
  pingMs: number | null;
}
function AppCard({ app, health, pingMs }: AppCardProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const authBadge = AUTH_BADGE[app.authMode];
  const handleOpen = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetchWithAuth(`/api/admin/autologin?app=${encodeURIComponent(app.key)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr((j as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }, [app.key]);
  return (
    <div className="group bg-void-light/50 flex flex-col rounded-xl border border-slate-800 p-5 transition-all hover:border-slate-700">
      {" "}
      <div className="mb-4 flex items-start justify-between gap-3">
        {" "}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/60 text-xl">
          {" "}
          {app.icon}{" "}
        </div>{" "}
        <div className="flex flex-col items-end gap-1.5">
          {" "}
          <span
            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${authBadge.klass}`}
          >
            {" "}
            {authBadge.label}{" "}
          </span>{" "}
          <HealthBadge status={health} pingMs={pingMs} />{" "}
        </div>{" "}
      </div>{" "}
      <div className="flex-1">
        {" "}
        <h3 className="font-heading mb-0.5 text-base font-semibold text-white">{app.name}</h3>{" "}
        <p className="font-body mb-1 text-xs text-slate-400">{app.description}</p>{" "}
        <p className="font-mono text-[10px] text-slate-600">{app.detail}</p>{" "}
      </div>{" "}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-800 pt-4">
        {" "}
        {err ? (
          <span className="flex-1 truncate font-mono text-[10px] text-red-400">{err}</span>
        ) : (
          <span className="flex-1" />
        )}{" "}
        <button
          onClick={handleOpen}
          disabled={busy}
          className="hover:border-neon-cyan/40 flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 font-mono text-xs font-medium text-slate-300 transition-all group-hover:border-slate-600 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {" "}
          {busy ? (
            <>
              {" "}
              <span className="h-3 w-3 animate-spin rounded-full border border-slate-600 border-t-slate-300" />{" "}
              Opening…{" "}
            </>
          ) : (
            <>Open →</>
          )}{" "}
        </button>{" "}
      </div>{" "}
    </div>
  );
}
function matchMonitorToApp(name: string): AppKey | null {
  const lower = name.toLowerCase();
  if (lower.includes("espocrm") || lower.includes("espo")) return "espocrm";
  if (lower.includes("appflowy") || lower.includes("flowy")) return "appflowy";
  if (lower.includes("n8n")) return "n8n";
  if (lower.includes("postiz")) return "postiz";
  if (lower.includes("grafana")) return "grafana";
  if (lower.includes("kuma")) return "kuma";
  return null;
}
export default function SelfhostedPortalPage() {
  const [healthMap, setHealthMap] = useState<Record<AppKey, HealthStatus>>({
    appflowy: "unknown",
    espocrm: "unknown",
    n8n: "unknown",
    postiz: "unknown",
    grafana: "unknown",
    kuma: "unknown",
  });
  const [pingMap, setPingMap] = useState<Record<AppKey, number | null>>({
    appflowy: null,
    espocrm: null,
    n8n: null,
    postiz: null,
    grafana: null,
    kuma: null,
  });
  const [kumaLoaded, setKumaLoaded] = useState(false);
  useEffect(() => {
    async function loadHealth() {
      try {
        const res = await fetchWithAuth("/api/admin/cluster/kuma-status");
        if (!res.ok) return;
        const json = await res.json();
        interface KumaStatusResponse {
          summary: KumaSummary | null;
        }
        const summary = (json as KumaStatusResponse).summary;
        if (!summary) return;
        const hMap: Record<AppKey, HealthStatus> = {
          appflowy: "unknown",
          espocrm: "unknown",
          n8n: "unknown",
          postiz: "unknown",
          grafana: "unknown",
          kuma: "unknown",
        };
        const pMap: Record<AppKey, number | null> = {
          appflowy: null,
          espocrm: null,
          n8n: null,
          postiz: null,
          grafana: null,
          kuma: null,
        };
        for (const m of summary.monitors) {
          const key = matchMonitorToApp(m.name);
          if (!key) continue;
          hMap[key] = m.status;
          pMap[key] = m.pingMs;
        }
        setHealthMap(hMap);
        setPingMap(pMap);
      } catch {
        /* silent */
      } finally {
        setKumaLoaded(true);
      }
    }
    loadHealth();
  }, []);
  const allUp =
    kumaLoaded && APPS.every((a) => healthMap[a.key] === "up" || healthMap[a.key] === "unknown");
  const anyDown = APPS.some((a) => healthMap[a.key] === "down");
  return (
    <div>
      {" "}
      <div className="mb-6">
        {" "}
        <Link href="/admin" className="font-mono text-xs text-slate-500 hover:text-slate-300">
          {" "}
          ← Admin{" "}
        </Link>{" "}
      </div>{" "}
      <div className="mb-8">
        {" "}
        <div className="border-neon-cyan/20 bg-neon-cyan/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          {" "}
          <span className="bg-neon-cyan h-2 w-2 rounded-full" />{" "}
          <span className="text-neon-cyan font-mono text-xs">SELF-HOSTED PORTAL</span>{" "}
        </div>{" "}
        <h1 className="font-heading text-2xl font-bold text-white">Self-hosted Apps</h1>{" "}
        <p className="font-body mt-2 text-sm text-slate-400">
          {" "}
          One-click admin ingress to every app running on the Pi cluster.{" "}
        </p>{" "}
        {kumaLoaded && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1.5">
            {" "}
            <span
              className={`h-1.5 w-1.5 rounded-full ${anyDown ? "animate-pulse bg-red-400" : "bg-neon-green"}`}
            />{" "}
            <span className="font-mono text-[10px] text-slate-400">
              {" "}
              {anyDown
                ? `${APPS.filter((a) => healthMap[a.key] === "down").length} app(s) down`
                : allUp
                  ? "All apps up"
                  : "Cluster health loading…"}{" "}
            </span>{" "}
          </div>
        )}{" "}
      </div>{" "}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {" "}
        {APPS.map((app) => (
          <AppCard key={app.key} app={app} health={healthMap[app.key]} pingMs={pingMap[app.key]} />
        ))}{" "}
      </div>{" "}
      <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/30 p-4">
        {" "}
        <p className="font-mono text-[10px] text-slate-500">
          {" "}
          <span className="text-neon-cyan">AUTO-LOGIN</span> apps inject a fresh server-side token.{" "}
          <span className="text-yellow-400">VPN ONLY</span> apps require Tailscale. Health badges
          from Uptime Kuma.{" "}
        </p>{" "}
      </div>{" "}
    </div>
  );
}
