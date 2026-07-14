/**
 * Admin — Infrastructure Monitor
 *
 * Live dashboard for the Pi cluster + ESP32 alert system.
 * Polls /api/admin/ops/monitor every 30 s; WebSocket log stream
 * connects directly to the Pi Alert API for the real-time console.
 *
 * Resources:
 *   ?resource=status  → combined Pi + ESP32 + alert counts
 *   ?resource=alerts  → full alert list
 *   ?resource=esp32   → ESP32 hardware status
 *
 * @module admin/monitor
 */
"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVisiblePoll } from "@/lib/use-visible-poll";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PiState {
  ip: string;
  status: "up" | "degraded" | "down";
  alerts: string[];
}

interface Esp32State {
  id: number;
  ip: string | null;
  rssi: number | null;
  firmware_ver: string | null;
  uptime_s: number | null;
  free_ram_bytes: number | null;
  last_heartbeat: string | null;
  stale: boolean;
}

interface StatusPayload {
  timestamp: string;
  pis: Record<string, PiState>;
  esp32: Esp32State;
  alerts: {
    active_count: number;
    resolved_count: number;
    total_count: number;
    by_severity: Record<string, number>;
  };
}

interface Alert {
  id: number;
  code: string;
  host: string;
  service: string;
  severity: string;
  message: string;
  status: string;
  count: number;
  first_seen: string;
  last_seen: string;
}

interface LogEntry {
  ts: string;
  level: string;
  message: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Returns the WebSocket URL for the alert-api, or empty string when unavailable.
 *  Only connects on LAN/localhost — blocks ws:// mixed content on HTTPS deployments.
 */
function getAlertApiWsUrl(): string {
  if (typeof window === "undefined") return "";
  const h = window.location.hostname;
  if (h.startsWith("192.168.") || h === "localhost") {
    return "wss://192.168.1.128:30800/ws/esp32-logs"; // nosemgrep: detect-insecure-websocket
  }
  return "";
}
const POLL_INTERVAL = 30_000;
const MAX_LOG_LINES = 150;

const SEV_COLOR: Record<string, string> = {
  critical: "text-red-400 border-red-900/40 bg-red-950/20",
  high: "text-orange-400 border-orange-900/40 bg-orange-950/20",
  medium: "text-yellow-400 border-yellow-900/40 bg-yellow-950/20",
  warning: "text-yellow-400 border-yellow-900/40 bg-yellow-950/20",
  low: "text-blue-400 border-blue-900/40 bg-blue-950/10",
  info: "text-neon-cyan border-neon-cyan/20 bg-neon-cyan/5",
};

const SEV_DOT: Record<string, string> = {
  critical: "bg-red-400",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  warning: "bg-yellow-400",
  low: "bg-blue-400",
  info: "bg-neon-cyan",
};

const STATUS_COLOR: Record<string, string> = {
  up: "text-neon-green",
  degraded: "text-yellow-400",
  down: "text-red-400",
};

const LOG_LEVEL_COLOR: Record<string, string> = {
  ERROR: "text-red-400",
  WARN: "text-yellow-400",
  INFO: "text-slate-300",
  DEBUG: "text-slate-500",
  ALERT: "text-orange-400",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUptime(s: number | null): string {
  if (s == null) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

function fmtRam(b: number | null): string {
  if (b == null) return "—";
  return `${(b / 1024).toFixed(1)} KB`;
}

function fmtTs(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IE", { timeZone: "Europe/Athens" });
}

function piStatusDot(status: string) {
  const map: Record<string, string> = {
    up: "bg-neon-green animate-pulse",
    degraded: "bg-yellow-400 animate-pulse",
    down: "bg-red-400 animate-pulse",
  };
  return map[status] ?? "bg-slate-600";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminMonitorPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed">(() =>
    getAlertApiWsUrl() ? "connecting" : "closed"
  );
  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, alertsRes] = await Promise.all([
        fetchWithAuth("/api/admin/ops/monitor?resource=status"),
        fetchWithAuth("/api/admin/ops/monitor?resource=alerts"),
      ]);

      if (!statusRes.ok) {
        const d = (await statusRes.json().catch(() => ({}))) as any;
        if (d.offline) {
          setOffline(true);
          setLoading(false);
          return;
        }
        throw new Error(`HTTP ${statusRes.status}`);
      }

      const statusData: StatusPayload = (await statusRes.json()) as any as any;
      setStatus(statusData);
      setOffline(false);

      if (alertsRes.ok) {
        const alertData = (await alertsRes.json()) as any as any as any;
        setAlerts(Array.isArray(alertData) ? alertData : []);
      } else {
        console.warn(
          "[monitor] alerts fetch returned %d — Pi Alert API may be degraded",
          alertsRes.status
        );
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  // Visibility-gated polling — pauses while the tab is hidden to avoid
  // amplifying Cloudflare Worker / API request volume.
  useVisiblePoll(fetchData, POLL_INTERVAL);

  // ── WebSocket log stream ───────────────────────────────────────────────────

  useEffect(() => {
    const wsUrl = getAlertApiWsUrl();
    if (!wsUrl) return;

    let ws: WebSocket;
    let retryTimer: ReturnType<typeof setTimeout>;
    let retryCount = 0;
    const MAX_RETRIES = 10;

    function connect() {
      if (retryCount >= MAX_RETRIES) {
        setWsStatus("closed");
        return;
      }
      try {
        setWsStatus("connecting");
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsStatus("open");
          retryCount = 0;
        };

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data as string);
            if (msg.type === "ping") return;
            const entry: LogEntry = {
              ts: msg.ts ?? new Date().toISOString(),
              level: (msg.level ?? "INFO").toUpperCase(),
              message: msg.message ?? JSON.stringify(msg),
            };
            setLogs((prev) => {
              const next = [...prev, entry];
              return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
            });
          } catch {
            // non-JSON frame
          }
        };

        ws.onerror = () => setWsStatus("closed");

        ws.onclose = () => {
          setWsStatus("closed");
          retryCount++;
          const delay = Math.min(1000 * 2 ** retryCount, 30_000);
          retryTimer = setTimeout(connect, delay);
        };
      } catch {
        setWsStatus("closed");
        retryCount++;
        const delay = Math.min(1000 * 2 ** retryCount, 30_000);
        retryTimer = setTimeout(connect, delay);
      }
    }

    connect();
    return () => {
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const activeAlerts = alerts.filter((a) => a.status !== "RESOLVED");
  const resolvedAlerts = alerts.filter((a) => a.status === "RESOLVED");

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="bg-neon-cyan/10 border-neon-cyan/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-cyan font-mono text-xs">LIVE MONITOR</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white">Infrastructure Monitor</h1>
            <p className="font-body mt-1 text-slate-400">
              Pi cluster · ESP32 sensor · Alert API v2.0 · Live log stream
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="border-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/10 min-h-[40px] shrink-0 rounded-lg border px-4 py-2 font-mono text-xs transition-colors disabled:opacity-50"
          >
            {loading ? "Loading…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {/* Offline banner */}
      {offline && (
        <div className="mb-6 rounded-xl border border-yellow-900/40 bg-yellow-950/20 px-5 py-4">
          <p className="font-mono text-sm text-yellow-400">
            ⚠ Alert API unreachable — Pi may be offline or this deployment does not have local
            network access.
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500">
            Dashboard data available only from the K3s Pi cluster.
          </p>
        </div>
      )}

      {error && !offline && (
        <div className="mb-6 rounded-xl border border-red-900/30 bg-red-950/10 px-5 py-4">
          <p className="font-mono text-sm text-red-400">✗ {error}</p>
        </div>
      )}

      {loading ? (
        <div className="bg-void-light/50 flex items-center justify-center rounded-xl border border-slate-800 py-20">
          <div className="border-neon-cyan h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      ) : status ? (
        <>
          {/* ── Summary KPIs ──────────────────────────────────────────────── */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
              <p className="font-mono text-xs text-slate-500">Active Alerts</p>
              <p
                className={`font-heading mt-1 text-2xl font-bold ${status.alerts.active_count === 0 ? "text-neon-green" : "text-red-400"}`}
              >
                {status.alerts.active_count}
              </p>
            </div>
            <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
              <p className="font-mono text-xs text-slate-500">Resolved</p>
              <p className="font-heading mt-1 text-2xl font-bold text-slate-300">
                {status.alerts.resolved_count}
              </p>
            </div>
            <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
              <p className="font-mono text-xs text-slate-500">Critical / High</p>
              <p className="font-heading mt-1 text-2xl font-bold text-red-400">
                {(status.alerts.by_severity.critical ?? 0) + (status.alerts.by_severity.high ?? 0)}
              </p>
            </div>
            <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
              <p className="font-mono text-xs text-slate-500">ESP32</p>
              <p
                className={`font-heading mt-1 text-2xl font-bold ${status.esp32.stale ? "text-yellow-400" : "text-neon-green"}`}
              >
                {status.esp32.stale ? "Stale" : "Online"}
              </p>
            </div>
          </div>

          {/* ── Pi Nodes ──────────────────────────────────────────────────── */}
          <h2 className="font-heading mb-3 text-sm font-semibold tracking-widest text-slate-500 uppercase">
            Pi Nodes
          </h2>
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            {Object.entries(status.pis).map(([name, pi]) => (
              <div key={name} className="bg-void-light/50 rounded-xl border border-slate-800 p-5">
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${piStatusDot(pi.status)}`} />
                  <span className="font-mono text-sm font-bold text-white">{name}</span>
                  <span
                    className={`ml-auto font-mono text-xs font-semibold ${STATUS_COLOR[pi.status] ?? "text-slate-400"}`}
                  >
                    {pi.status.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-xs text-slate-500">{pi.ip}</p>
                {pi.alerts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {pi.alerts.map((code) => (
                      <span
                        key={code}
                        className="rounded border border-red-900/40 bg-red-950/20 px-2 py-0.5 font-mono text-[10px] text-red-400"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── ESP32 ─────────────────────────────────────────────────────── */}
          <h2 className="font-heading mb-3 text-sm font-semibold tracking-widest text-slate-500 uppercase">
            ESP32 Sensor
          </h2>
          <div className="bg-void-light/50 mb-6 rounded-xl border border-slate-800 p-5">
            <div className="mb-4 flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full ${status.esp32.stale ? "animate-pulse bg-yellow-400" : "bg-neon-green animate-pulse"}`}
              />
              <span className="font-mono text-sm font-bold text-white">ESP32 Alert Manager</span>
              <span
                className={`ml-auto font-mono text-xs font-semibold ${status.esp32.stale ? "text-yellow-400" : "text-neon-green"}`}
              >
                {status.esp32.stale ? "STALE" : "LIVE"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: "IP", value: status.esp32.ip ?? "—" },
                { label: "Firmware", value: status.esp32.firmware_ver ?? "—" },
                {
                  label: "RSSI",
                  value: status.esp32.rssi != null ? `${status.esp32.rssi} dBm` : "—",
                },
                { label: "Uptime", value: fmtUptime(status.esp32.uptime_s) },
                {
                  label: "Free RAM",
                  value: fmtRam(status.esp32.free_ram_bytes),
                },
                { label: "Last HB", value: fmtTs(status.esp32.last_heartbeat) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="font-mono text-[10px] text-slate-500">{label}</p>
                  <p className="font-mono text-xs text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Active Alerts ─────────────────────────────────────────────── */}
          <h2 className="font-heading mb-3 text-sm font-semibold tracking-widest text-slate-500 uppercase">
            Active Alerts ({activeAlerts.length})
          </h2>
          <div className="mb-6 space-y-3">
            {activeAlerts.length === 0 ? (
              <div className="bg-void-light/50 rounded-xl border border-slate-800 p-8 text-center">
                <p className="text-neon-green text-3xl">✓</p>
                <p className="font-heading mt-3 font-semibold text-white">All Clear</p>
                <p className="mt-1 font-mono text-xs text-slate-500">No active alerts.</p>
              </div>
            ) : (
              activeAlerts.map((alert) => {
                const cls = SEV_COLOR[alert.severity] ?? SEV_COLOR.info;
                const dot = SEV_DOT[alert.severity] ?? "bg-slate-500";
                return (
                  <div key={alert.id} className={`rounded-xl border p-5 ${cls}`}>
                    <div className="flex flex-wrap items-start gap-3">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold">{alert.code}</span>
                          <span className="rounded border border-current/30 px-1.5 py-0.5 font-mono text-[10px] opacity-70">
                            {alert.status}
                          </span>
                          <span className="rounded border border-current/30 px-1.5 py-0.5 font-mono text-[10px] opacity-70">
                            {alert.severity}
                          </span>
                        </div>
                        <p className="mt-0.5 font-mono text-xs opacity-80">{alert.message}</p>
                        <p className="mt-1 font-mono text-[10px] opacity-50">
                          {alert.host} · {alert.service} · ×{alert.count} · {fmtTs(alert.last_seen)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Recently Resolved ─────────────────────────────────────────── */}
          {resolvedAlerts.length > 0 && (
            <>
              <h2 className="font-heading mb-3 text-sm font-semibold tracking-widest text-slate-500 uppercase">
                Recently Resolved ({resolvedAlerts.length})
              </h2>
              <div className="mb-6 space-y-2">
                {resolvedAlerts.slice(0, 10).map((alert) => (
                  <div
                    key={alert.id}
                    className="bg-void-light/30 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800/60 px-4 py-3 opacity-60"
                  >
                    <span className="bg-neon-green h-2 w-2 rounded-full" />
                    <span className="font-mono text-xs font-bold text-slate-300">{alert.code}</span>
                    <span className="font-mono text-[10px] text-slate-500">{alert.host}</span>
                    <span className="ml-auto font-mono text-[10px] text-slate-600">
                      {fmtTs(alert.last_seen)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : null}

      {/* ── Live Log Stream ───────────────────────────────────────────────── */}
      <h2 className="font-heading mb-3 text-sm font-semibold tracking-widest text-slate-500 uppercase">
        Live Log Stream
      </h2>
      <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
        {/* WS status bar */}
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2">
          <span
            className={`h-2 w-2 rounded-full ${wsStatus === "open" ? "bg-neon-green animate-pulse" : wsStatus === "connecting" ? "animate-pulse bg-yellow-400" : "bg-red-400"}`}
          />
          <span className="font-mono text-[10px] text-slate-500">
            {wsStatus === "open"
              ? `ws/esp32-logs — connected (${logs.length} lines)`
              : wsStatus === "connecting"
                ? "Connecting to log stream…"
                : getAlertApiWsUrl()
                  ? "Log stream disconnected — retrying…"
                  : "WebSocket unavailable on this deployment"}
          </span>
        </div>

        {/* Log lines */}
        <div className="h-80 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed">
          {logs.length === 0 ? (
            <p className="text-slate-600">
              {getAlertApiWsUrl()
                ? "Waiting for log entries…"
                : "WebSocket stream not available on this deployment."}
            </p>
          ) : (
            logs.map((entry, i) => (
              <div key={i} className="flex gap-3">
                <span className="shrink-0 text-slate-600 select-none">
                  {new Date(entry.ts).toLocaleTimeString("en-IE", {
                    timeZone: "Europe/Athens",
                    hour12: false,
                  })}
                </span>
                <span
                  className={`w-12 shrink-0 ${LOG_LEVEL_COLOR[entry.level] ?? "text-slate-400"}`}
                >
                  {entry.level}
                </span>
                <span className="break-all text-slate-300">{entry.message}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      <p className="mt-4 font-mono text-[10px] text-slate-600">
        Auto-refreshes every {POLL_INTERVAL / 1000}s
        {getAlertApiWsUrl() ? " · WebSocket reconnects automatically" : ""} · Last fetched:{" "}
        {status ? fmtTs(status.timestamp) : "—"}
      </p>
    </div>
  );
}
