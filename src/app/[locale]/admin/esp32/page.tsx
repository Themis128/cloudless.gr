/**
 * Admin — ESP32 Dashboard
 *
 * Dedicated view for the ESP32 out-of-band sensor:
 *   - Live hardware metrics (IP, RSSI, firmware, uptime, RAM, device ID)
 *   - Full log history from GET /api/esp32/logs (REST, paginated)
 *   - Real-time log stream via WebSocket /ws/esp32-logs
 *   - ESP32-specific alert history filtered from /api/alerts
 *
 * @module admin/esp32
 */
"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVisiblePoll } from "@/lib/use-visible-poll";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Esp32Status {
  id: number;
  ip: string | null;
  rssi: number | null;
  firmware_ver: string | null;
  uptime_s: number | null;
  free_ram_bytes: number | null;
  last_heartbeat: string | null;
  started_at: string | null;
  device_id: string | null;
  stale: boolean;
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
  resolved_at: string | null;
  resolved_by: string | null;
}

interface LogEntry {
  id: number;
  ts: string;
  level: string;
  message: string;
  historic?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Returns the WebSocket URL for the alert-api based on current hostname.
 *  - LAN / localhost → Pi alert-api
 *  - cloudless.gr (AWS Lambda) → '' (WebSocket disabled)
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
const MAX_WS_LINES = 200;

const SEV_COLOR: Record<string, string> = {
  critical: "text-red-400 border-red-900/40 bg-red-950/20",
  high: "text-orange-400 border-orange-900/40 bg-orange-950/20",
  medium: "text-yellow-400 border-yellow-900/40 bg-yellow-950/20",
  low: "text-blue-400 border-blue-900/40 bg-blue-950/10",
  info: "text-neon-cyan border-neon-cyan/20 bg-neon-cyan/5",
};

const SEV_DOT: Record<string, string> = {
  critical: "bg-red-400",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  low: "bg-blue-400",
  info: "bg-neon-cyan",
};

const LOG_COLOR: Record<string, string> = {
  ERROR: "text-red-400",
  WARN: "text-yellow-400",
  INFO: "text-slate-300",
  DEBUG: "text-slate-500",
  ALERT: "text-orange-400",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUptime(s: number | null): string {
  if (s == null) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${sec}s`;
}

function fmtRam(b: number | null): string {
  if (b == null) return "—";
  return `${(b / 1024).toFixed(1)} KB`;
}

function fmtTs(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IE", { timeZone: "Europe/Athens" });
}

function rssiBar(rssi: number | null): { width: string; color: string } {
  if (rssi == null) return { width: "0%", color: "bg-slate-600" };
  // RSSI typically -30 (excellent) to -90 (poor)
  const pct = Math.max(0, Math.min(100, ((rssi + 90) / 60) * 100));
  const color = rssi >= -60 ? "bg-neon-green" : rssi >= -75 ? "bg-yellow-400" : "bg-red-400";
  return { width: `${pct.toFixed(0)}%`, color };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminEsp32Page() {
  const [esp32, setEsp32] = useState<Esp32Status | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [wsLogs, setWsLogs] = useState<LogEntry[]>([]);
  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed">(() =>
    getAlertApiWsUrl() ? "connecting" : "closed"
  );
  const [logFilter, setLogFilter] = useState<string>("ALL");
  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [esp32Res, alertsRes] = await Promise.all([
        fetchWithAuth("/api/admin/ops/monitor?resource=esp32"),
        fetchWithAuth("/api/admin/ops/monitor?resource=alerts"),
      ]);

      if (!esp32Res.ok) {
        const d = (await esp32Res.json().catch(() => ({}))) as { offline?: boolean };
        if (d.offline) {
          setOffline(true);
          setLoading(false);
          return;
        }
        throw new Error(`HTTP ${esp32Res.status}`);
      }

      const esp32Data: Esp32Status = await esp32Res.json();
      setEsp32(esp32Data);
      setOffline(false);

      if (alertsRes.ok) {
        const allAlerts: Alert[] = await alertsRes.json();
        // Filter to only ESP32 alerts
        const esp32Alerts = Array.isArray(allAlerts)
          ? allAlerts.filter((a) => a.host === "esp32" || a.code.startsWith("ESP32_"))
          : [];
        setAlerts(esp32Alerts);
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
              id: msg.id ?? Date.now(),
              ts: msg.ts ?? new Date().toISOString(),
              level: (msg.level ?? "INFO").toUpperCase(),
              message: msg.message ?? JSON.stringify(msg),
              historic: msg.historic ?? false,
            };
            setWsLogs((prev) => {
              const next = [...prev, entry];
              return next.length > MAX_WS_LINES ? next.slice(-MAX_WS_LINES) : next;
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

  // Auto-scroll
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [wsLogs]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeAlerts = alerts.filter((a) => a.status !== "RESOLVED");
  const resolvedAlerts = alerts.filter((a) => a.status === "RESOLVED");

  const filteredLogs = logFilter === "ALL" ? wsLogs : wsLogs.filter((l) => l.level === logFilter);

  const rssi = rssiBar(esp32?.rssi ?? null);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="bg-neon-cyan/10 border-neon-cyan/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-cyan font-mono text-xs">ESP32 SENSOR</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white">ESP32 Dashboard</h1>
            <p className="font-body mt-1 text-slate-400">
              Hardware status · Out-of-band log stream · Alert history
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
            ⚠ Alert API unreachable — Pi may be offline.
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
      ) : esp32 ? (
        <>
          {/* ── Hardware Status ────────────────────────────────────────────── */}
          <h2 className="font-heading mb-3 text-sm font-semibold tracking-widest text-slate-500 uppercase">
            Hardware
          </h2>
          <div className="bg-void-light/50 mb-6 rounded-xl border border-slate-800 p-6">
            {/* Online indicator */}
            <div className="mb-5 flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full ${esp32.stale ? "animate-pulse bg-yellow-400" : "bg-neon-green animate-pulse"}`}
              />
              <span className="font-mono text-sm font-bold text-white">ESP32 Alert Manager</span>
              <span
                className={`ml-auto rounded px-2 py-0.5 font-mono text-xs font-semibold ${esp32.stale ? "bg-yellow-950/30 text-yellow-400" : "text-neon-green bg-neon-green/10"}`}
              >
                {esp32.stale ? "STALE" : "LIVE"}
              </span>
            </div>

            {/* Metric grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <div>
                <p className="font-mono text-[10px] text-slate-500">IP Address</p>
                <p className="font-mono text-sm text-white">{esp32.ip ?? "—"}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-slate-500">Firmware</p>
                <p className="font-mono text-sm text-white">{esp32.firmware_ver ?? "—"}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-slate-500">Uptime</p>
                <p className="font-mono text-sm text-white">{fmtUptime(esp32.uptime_s)}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-slate-500">Free RAM</p>
                <p
                  className={`font-mono text-sm ${
                    esp32.free_ram_bytes != null && esp32.free_ram_bytes < 60000
                      ? "text-red-400"
                      : "text-white"
                  }`}
                >
                  {fmtRam(esp32.free_ram_bytes)}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-slate-500">Last Heartbeat</p>
                <p className="font-mono text-xs text-white">{fmtTs(esp32.last_heartbeat)}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-slate-500">Online Since</p>
                <p className="font-mono text-xs text-white">{fmtTs(esp32.started_at)}</p>
              </div>
              {esp32.device_id && (
                <div className="col-span-2">
                  <p className="font-mono text-[10px] text-slate-500">Device ID</p>
                  <p className="font-mono text-xs text-slate-300">{esp32.device_id}</p>
                </div>
              )}
            </div>

            {/* RSSI bar */}
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="font-mono text-[10px] text-slate-500">WiFi Signal (RSSI)</p>
                <p className="font-mono text-xs text-slate-400">
                  {esp32.rssi != null ? `${esp32.rssi} dBm` : "—"}
                </p>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all ${rssi.color}`}
                  style={{ width: rssi.width }}
                />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-600">
                <span>Poor (−90)</span>
                <span>Excellent (−30)</span>
              </div>
            </div>
          </div>

          {/* ── ESP32 Alerts ───────────────────────────────────────────────── */}
          <h2 className="font-heading mb-3 text-sm font-semibold tracking-widest text-slate-500 uppercase">
            Active Alerts ({activeAlerts.length})
          </h2>
          <div className="mb-6 space-y-3">
            {activeAlerts.length === 0 ? (
              <div className="bg-void-light/50 rounded-xl border border-slate-800 p-8 text-center">
                <p className="text-neon-green text-3xl">✓</p>
                <p className="font-heading mt-3 font-semibold text-white">All Clear</p>
                <p className="mt-1 font-mono text-xs text-slate-500">No active ESP32 alerts.</p>
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
                            ×{alert.count}
                          </span>
                        </div>
                        <p className="mt-0.5 font-mono text-xs opacity-80">{alert.message}</p>
                        <p className="mt-1 font-mono text-[10px] opacity-50">
                          First: {fmtTs(alert.first_seen)} · Last: {fmtTs(alert.last_seen)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {resolvedAlerts.length > 0 && (
            <>
              <h2 className="font-heading mb-3 text-sm font-semibold tracking-widest text-slate-500 uppercase">
                Resolved ({resolvedAlerts.length})
              </h2>
              <div className="mb-6 space-y-2">
                {resolvedAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className="bg-void-light/30 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800/60 px-4 py-3 opacity-60"
                  >
                    <span className="bg-neon-green h-2 w-2 rounded-full" />
                    <span className="font-mono text-xs font-bold text-slate-300">{alert.code}</span>
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

      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap gap-2">
        {["ALL", "ERROR", "WARN", "INFO", "DEBUG", "ALERT"].map((lvl) => (
          <button
            key={lvl}
            onClick={() => setLogFilter(lvl)}
            className={`rounded px-2.5 py-1 font-mono text-[10px] transition-colors ${
              logFilter === lvl
                ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40 border"
                : "border border-slate-800 text-slate-500 hover:text-slate-300"
            }`}
          >
            {lvl}
          </button>
        ))}
        <span className="ml-auto self-center font-mono text-[10px] text-slate-600">
          {filteredLogs.length} lines
        </span>
      </div>

      <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
        {/* WS status bar */}
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2">
          <span
            className={`h-2 w-2 rounded-full ${
              wsStatus === "open"
                ? "bg-neon-green animate-pulse"
                : wsStatus === "connecting"
                  ? "animate-pulse bg-yellow-400"
                  : "bg-red-400"
            }`}
          />
          <span className="font-mono text-[10px] text-slate-500">
            {wsStatus === "open"
              ? `ws/esp32-logs — connected`
              : wsStatus === "connecting"
                ? "Connecting to log stream…"
                : getAlertApiWsUrl()
                  ? "Disconnected — retrying in 5s"
                  : "WebSocket unavailable on this deployment"}
          </span>
        </div>

        {/* Log output */}
        <div className="h-96 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed">
          {filteredLogs.length === 0 ? (
            <p className="text-slate-600">
              {wsStatus === "open"
                ? "Waiting for log entries…"
                : getAlertApiWsUrl()
                  ? "Not connected — will retry in 5s…"
                  : "WebSocket stream not available on this deployment."}
            </p>
          ) : (
            filteredLogs.map((entry, i) => (
              <div key={i} className={`flex gap-3 ${entry.historic ? "opacity-50" : ""}`}>
                <span className="shrink-0 text-slate-600 select-none">
                  {new Date(entry.ts).toLocaleTimeString("en-IE", {
                    timeZone: "Europe/Athens",
                    hour12: false,
                  })}
                </span>
                <span className={`w-12 shrink-0 ${LOG_COLOR[entry.level] ?? "text-slate-400"}`}>
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
        Polls every {POLL_INTERVAL / 1000}s
        {getAlertApiWsUrl() ? " · WebSocket reconnects automatically" : ""}· Last fetched:{" "}
        {esp32 ? fmtTs(esp32.last_heartbeat) : "—"}
      </p>
    </div>
  );
}
