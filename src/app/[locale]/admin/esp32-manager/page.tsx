"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useState } from "react";
import { useVisiblePoll } from "@/lib/use-visible-poll";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Device {
  device_id: string;
  ip?: string;
  rssi?: number;
  firmware_ver?: string;
  uptime_s?: number;
  free_ram_bytes?: number;
  last_heartbeat?: string;
  stale: boolean;
}

interface DeviceConfig {
  device_id: string;
  brightness: number;
  heartbeat_interval_s: number;
  mqtt_qos: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_MS = 30_000;
const SEVERITIES = ["ok", "info", "warning", "error", "high", "critical"] as const;
type Severity = (typeof SEVERITIES)[number];

const SEV: Record<
  Severity,
  { bg: string; ring: string; text: string; label: string; dot: string }
> = {
  ok: {
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/40",
    text: "text-emerald-400",
    label: "OK",
    dot: "bg-emerald-500",
  },
  info: {
    bg: "bg-blue-500/10",
    ring: "ring-blue-500/40",
    text: "text-blue-400",
    label: "Info",
    dot: "bg-blue-400",
  },
  warning: {
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/40",
    text: "text-amber-400",
    label: "Warning",
    dot: "bg-amber-400",
  },
  error: {
    bg: "bg-orange-500/10",
    ring: "ring-orange-500/40",
    text: "text-orange-400",
    label: "Error",
    dot: "bg-orange-400",
  },
  high: {
    bg: "bg-red-500/10",
    ring: "ring-red-500/40",
    text: "text-red-400",
    label: "High",
    dot: "bg-red-400",
  },
  critical: {
    bg: "bg-red-700/20",
    ring: "ring-red-500/60",
    text: "text-red-300",
    label: "Critical",
    dot: "bg-red-500",
  },
};

function fmtUptime(s?: number): string {
  if (!s) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtRam(b?: number): string {
  if (!b) return "—";
  return b >= 1024 ? `${(b / 1024).toFixed(0)} KB` : `${b} B`;
}

function fmtTs(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RssiBar({ rssi }: { rssi?: number }) {
  if (!rssi) return <span className="font-mono text-xs text-slate-500">—</span>;
  const pct = Math.max(0, Math.min(100, ((rssi + 100) / 70) * 100));
  const color = pct > 60 ? "bg-emerald-500" : pct > 30 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-700">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-slate-400">{rssi} dBm</span>
    </div>
  );
}

function StatusChip({ stale }: { stale: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-xs ${
        stale ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          stale ? "bg-amber-400" : "animate-pulse bg-emerald-400"
        }`}
      />
      {stale ? "Stale" : "Online"}
    </span>
  );
}

function Feedback({ msg }: { msg: string }) {
  if (!msg) return null;
  const ok = msg.startsWith("✓");
  return (
    <p className={`mt-2 font-mono text-xs ${ok ? "text-emerald-400" : "text-red-400"}`}>{msg}</p>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 font-mono text-sm transition-all ${
        active
          ? "bg-neon-magenta/15 text-neon-magenta ring-neon-magenta/30 ring-1"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/50 p-5 ${className}`}>
      {children}
    </div>
  );
}

// ── DeviceSelect ───────────────────────────────────────────────────────────────

interface DeviceSelectProps {
  devices: Device[];
  selectedId: string;
  setSelectedId: (id: string) => void;
}

function DeviceSelect({ devices, selectedId, setSelectedId }: DeviceSelectProps) {
  return devices.length > 1 ? (
    <div className="mb-4">
      <label className="mb-1 block font-mono text-xs text-slate-500">Device</label>
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="focus:border-neon-magenta w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white focus:outline-none"
      >
        {devices.map((d) => (
          <option key={d.device_id} value={d.device_id}>
            {d.device_id} {d.stale ? "(stale)" : "(online)"}
          </option>
        ))}
      </select>
    </div>
  ) : null;
}

// ── Main component ─────────────────────────────────────────────────────────────

type Tab = "devices" | "led" | "config" | "ota";

export default function Esp32ManagerPage() {
  const [tab, setTab] = useState<Tab>("devices");
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState("esp32-leds");
  const [offline, setOffline] = useState(false);

  // LED tab
  const [ledFeedback, setLedFeedback] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [brightness, setBrightness] = useState(80);

  // Config tab
  const [config, setConfig] = useState<DeviceConfig | null>(null);
  const [configDirty, setConfigDirty] = useState(false);
  const [configFeedback, setConfigFeedback] = useState("");
  const [configLoading, setConfigLoading] = useState(false);

  // OTA tab
  const [otaUrl, setOtaUrl] = useState("");
  const [otaVersion, setOtaVersion] = useState("");
  const [otaFeedback, setOtaFeedback] = useState("");
  const [otaLoading, setOtaLoading] = useState(false);

  // ── API helpers ──────────────────────────────────────────────────────────────

  const call = useCallback(async (path: string, opts?: RequestInit) => {
    try {
      const res = await fetchWithAuth(path, opts);
      const json = (await res.json()) as { offline?: boolean };
      if (json?.offline) {
        setOffline(true);
        return null;
      }
      setOffline(false);
      return json;
    } catch {
      setOffline(true);
      return null;
    }
  }, []);

  const sendCmd = useCallback(
    async (action: string, value?: unknown) => {
      setLedFeedback("");
      const res = await call(`/api/admin/esp32?action=command&device_id=${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, value }),
      });
      // `call` returns parsed JSON or null (offline). Treat non-null as success
      // since the Pi command endpoint returns {} or {ok:true} on success.
      const msg = res !== null && !res?.offline ? `✓ ${action} sent` : "✗ Command failed";
      setLedFeedback(msg);
      setTimeout(() => setLedFeedback(""), 3500);
    },
    [call, selectedId]
  );

  // ── Devices tab ──────────────────────────────────────────────────────────────

  const loadDevices = useCallback(async () => {
    const data = await call("/api/admin/esp32?action=devices");
    if (Array.isArray(data)) setDevices(data);
  }, [call]);

  // Visibility-gated polling — pauses while the tab is hidden to avoid
  // amplifying Cloudflare Worker / API request volume.
  useVisiblePoll(loadDevices, POLL_MS);

  // ── Config tab ───────────────────────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    const data = await call(`/api/admin/esp32?action=config&device_id=${selectedId}`);
    if (data && !data.offline) {
      setConfig(data as DeviceConfig);
      setConfigDirty(false);
    }
    setConfigLoading(false);
  }, [call, selectedId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === "config") loadConfig().catch(() => {});
  }, [tab, loadConfig]);

  const saveConfig = useCallback(async () => {
    if (!config) return;
    setConfigLoading(true);
    setConfigFeedback("");
    const res = await call(`/api/admin/esp32?action=config&device_id=${selectedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setConfigLoading(false);
    const success = res !== null && !res?.offline;
    const msg = success ? "✓ Config saved & published to device" : "✗ Save failed";
    setConfigFeedback(msg);
    if (success) setConfigDirty(false);
    setTimeout(() => setConfigFeedback(""), 4000);
  }, [call, config, selectedId]);

  // ── OTA tab ──────────────────────────────────────────────────────────────────

  const triggerOta = useCallback(async () => {
    const url = otaUrl.trim();
    if (!url) return;
    // ESP32 HTTPUpdate requires an HTTP (not HTTPS) URL reachable from the Pi LAN.
    // The .bin extension is required — the partition bootloader verifies the magic bytes.
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setOtaFeedback("✗ URL must start with http:// or https://");
      return;
    }
    if (!url.toLowerCase().endsWith(".bin")) {
      setOtaFeedback("✗ URL must point to a .bin firmware file");
      return;
    }
    setOtaLoading(true);
    setOtaFeedback("");
    const res = await call("/api/admin/esp32?action=ota", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: selectedId,
        firmware_url: otaUrl.trim(),
        version: otaVersion.trim() || undefined,
      }),
    });
    setOtaLoading(false);
    const success = res !== null && !res?.offline;
    const msg = success
      ? `✓ OTA command sent to ${selectedId} — device will reboot when done`
      : "✗ Failed to send OTA command";
    setOtaFeedback(msg);
  }, [call, selectedId, otaUrl, otaVersion]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-xl font-bold text-white">ESP32 Manager</h1>
          <p className="mt-1 font-mono text-xs text-slate-500">
            Remote control · LED display · OTA firmware
          </p>
        </div>
        {offline && (
          <span className="rounded-lg bg-red-500/10 px-3 py-1.5 font-mono text-xs text-red-400 ring-1 ring-red-500/30">
            ✗ Pi unreachable
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        <TabBtn active={tab === "devices"} onClick={() => setTab("devices")}>
          Devices
        </TabBtn>
        <TabBtn active={tab === "led"} onClick={() => setTab("led")}>
          LED Control
        </TabBtn>
        <TabBtn active={tab === "config"} onClick={() => setTab("config")}>
          Config
        </TabBtn>
        <TabBtn active={tab === "ota"} onClick={() => setTab("ota")}>
          OTA Update
        </TabBtn>
      </div>

      {/* ── Devices tab ─────────────────────────────────────────────────────── */}
      {tab === "devices" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-slate-500">
              {devices.length} device{devices.length !== 1 ? "s" : ""} registered
            </p>
            <button
              type="button"
              onClick={loadDevices}
              className="rounded-lg bg-slate-800 px-3 py-1.5 font-mono text-xs text-slate-300 hover:bg-slate-700"
            >
              Refresh
            </button>
          </div>

          {devices.length === 0 ? (
            <Card>
              <p className="text-center font-mono text-sm text-slate-500">
                No devices yet — ESP32 will appear after first heartbeat.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {devices.map((d) => (
                <Card key={d.device_id}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-white">
                      {d.device_id}
                    </span>
                    <StatusChip stale={d.stale} />
                  </div>
                  <dl className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <dt className="font-mono text-xs text-slate-500">IP</dt>
                      <dd className="font-mono text-xs text-slate-300">{d.ip ?? "—"}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="font-mono text-xs text-slate-500">Signal</dt>
                      <dd>
                        <RssiBar rssi={d.rssi} />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="font-mono text-xs text-slate-500">Uptime</dt>
                      <dd className="font-mono text-xs text-slate-300">{fmtUptime(d.uptime_s)}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="font-mono text-xs text-slate-500">Free RAM</dt>
                      <dd className="font-mono text-xs text-slate-300">
                        {fmtRam(d.free_ram_bytes)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="font-mono text-xs text-slate-500">Firmware</dt>
                      <dd className="font-mono text-xs text-slate-300">{d.firmware_ver ?? "—"}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="font-mono text-xs text-slate-500">Last seen</dt>
                      <dd className="font-mono text-xs text-slate-300">
                        {fmtTs(d.last_heartbeat)}
                      </dd>
                    </div>
                  </dl>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── LED Control tab ──────────────────────────────────────────────────── */}
      {tab === "led" && (
        <div className="space-y-5">
          <DeviceSelect devices={devices} selectedId={selectedId} setSelectedId={setSelectedId} />

          {/* Severity buttons */}
          <Card>
            <p className="mb-3 font-mono text-xs text-slate-500">Force LED mode</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendCmd("led_mode", s)}
                  className={`rounded-lg px-4 py-3 font-mono text-sm font-medium ring-1 transition-all hover:scale-105 active:scale-95 ${SEV[s].bg} ${SEV[s].text} ${SEV[s].ring}`}
                >
                  <span className={`mr-2 inline-block h-2 w-2 rounded-full ${SEV[s].dot}`} />
                  {SEV[s].label}
                </button>
              ))}
            </div>
            <p className="mt-3 font-mono text-xs text-slate-600">
              Override clears when the device receives a new MQTT status message.
            </p>
          </Card>

          {/* Quick actions */}
          <Card>
            <p className="mb-3 font-mono text-xs text-slate-500">Quick actions</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  sendCmd("led_mute", !isMuted);
                  setIsMuted((m) => !m);
                }}
                className={`rounded-lg px-4 py-2 font-mono text-sm ring-1 transition-all hover:scale-105 active:scale-95 ${
                  isMuted
                    ? "bg-blue-500/10 text-blue-400 ring-blue-500/30"
                    : "bg-slate-800 text-slate-300 ring-slate-700"
                }`}
              >
                {isMuted ? "🔇 Unmute" : "🔇 Mute"}
              </button>
              <button
                type="button"
                onClick={() => sendCmd("led_test")}
                className="rounded-lg bg-slate-800 px-4 py-2 font-mono text-sm text-slate-300 ring-1 ring-slate-700 transition-all hover:scale-105 active:scale-95"
              >
                ✦ Test pattern
              </button>
              <button
                type="button"
                onClick={() => sendCmd("clear_override")}
                className="rounded-lg bg-slate-800 px-4 py-2 font-mono text-sm text-slate-400 ring-1 ring-slate-700 transition-all hover:scale-105 active:scale-95"
              >
                ↺ Clear override
              </button>
            </div>
          </Card>

          {/* Brightness */}
          <Card>
            <label className="mb-3 flex items-center justify-between">
              <span className="font-mono text-xs text-slate-500">Brightness</span>
              <span className="font-mono text-xs text-slate-300">{brightness}</span>
            </label>
            <input
              type="range"
              min={0}
              max={255}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              onMouseUp={() => sendCmd("set_brightness", brightness)}
              onTouchEnd={() => sendCmd("set_brightness", brightness)}
              className="accent-neon-magenta w-full"
            />
            <div className="mt-1 flex justify-between font-mono text-xs text-slate-600">
              <span>0</span>
              <span>255</span>
            </div>
          </Card>

          {/* Danger zone */}
          <Card className="border-red-900/40">
            <p className="mb-3 font-mono text-xs text-red-500">Danger zone</p>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Reboot ${selectedId}?`)) sendCmd("reboot");
              }}
              className="rounded-lg bg-red-500/10 px-4 py-2 font-mono text-sm text-red-400 ring-1 ring-red-500/30 hover:bg-red-500/20"
            >
              ⚠ Reboot device
            </button>
          </Card>

          <Feedback msg={ledFeedback} />
        </div>
      )}

      {/* ── Config tab ───────────────────────────────────────────────────────── */}
      {tab === "config" && (
        <div className="space-y-5">
          <DeviceSelect devices={devices} selectedId={selectedId} setSelectedId={setSelectedId} />

          {configLoading && !config ? (
            <Card>
              <p className="font-mono text-sm text-slate-500">Loading config…</p>
            </Card>
          ) : config ? (
            <Card>
              <p className="mb-4 font-mono text-xs text-slate-500">
                Config is published as a retained MQTT message — device applies it on next
                boot/reconnect.
              </p>
              <div className="space-y-5">
                {/* Brightness */}
                <div>
                  <label className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400">LED brightness</span>
                    <span className="font-mono text-xs text-white">{config.brightness}</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={config.brightness}
                    onChange={(e) => {
                      setConfig((c) => (c ? { ...c, brightness: Number(e.target.value) } : c));
                      setConfigDirty(true);
                    }}
                    className="accent-neon-magenta w-full"
                  />
                </div>

                {/* Heartbeat interval */}
                <div>
                  <label className="mb-1 block font-mono text-xs text-slate-400">
                    Heartbeat interval (seconds)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={3600}
                    value={config.heartbeat_interval_s}
                    onChange={(e) => {
                      setConfig((c) =>
                        c ? { ...c, heartbeat_interval_s: Number(e.target.value) } : c
                      );
                      setConfigDirty(true);
                    }}
                    className="focus:border-neon-magenta w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white focus:outline-none"
                  />
                </div>

                {/* MQTT QoS */}
                <div>
                  <label className="mb-1 block font-mono text-xs text-slate-400">MQTT QoS</label>
                  <select
                    value={config.mqtt_qos}
                    onChange={(e) => {
                      setConfig((c) => (c ? { ...c, mqtt_qos: Number(e.target.value) } : c));
                      setConfigDirty(true);
                    }}
                    className="focus:border-neon-magenta w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white focus:outline-none"
                  >
                    <option value={0}>0 — At most once</option>
                    <option value={1}>1 — At least once</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={saveConfig}
                  disabled={!configDirty || configLoading}
                  className="bg-neon-magenta/15 text-neon-magenta ring-neon-magenta/30 hover:bg-neon-magenta/25 w-full rounded-lg py-2.5 font-mono text-sm ring-1 transition-all disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {configLoading ? "Saving…" : "Save & publish to device"}
                </button>
              </div>
              <Feedback msg={configFeedback} />
            </Card>
          ) : (
            <Card>
              <p className="font-mono text-sm text-slate-500">
                Could not load config.{" "}
                <button onClick={loadConfig} className="text-neon-magenta underline">
                  Retry
                </button>
              </p>
            </Card>
          )}
        </div>
      )}

      {/* ── OTA tab ──────────────────────────────────────────────────────────── */}
      {tab === "ota" && (
        <div className="space-y-5">
          <DeviceSelect devices={devices} selectedId={selectedId} setSelectedId={setSelectedId} />

          <Card>
            <p className="mb-4 font-mono text-xs text-slate-500">
              Provide a public URL to the compiled <code>.bin</code> firmware. The device will
              download and flash it over WiFi, then reboot automatically.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block font-mono text-xs text-slate-400">
                  Firmware URL <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/firmware/esp32.bin"
                  value={otaUrl}
                  onChange={(e) => setOtaUrl(e.target.value)}
                  className="focus:border-neon-magenta w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-mono text-xs text-slate-400">
                  Version label <span className="text-slate-600">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 4.1"
                  value={otaVersion}
                  onChange={(e) => setOtaVersion(e.target.value)}
                  className="focus:border-neon-magenta w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div className="rounded-lg bg-amber-500/10 p-3 ring-1 ring-amber-500/20">
                <p className="font-mono text-xs text-amber-400">
                  ⚠ The device will go offline during flash (~30 s). LEDs will glow cyan. Ensure the
                  firmware URL is reachable from the Pi LAN (192.168.1.x).
                </p>
              </div>

              <button
                type="button"
                onClick={triggerOta}
                disabled={!otaUrl.trim() || otaLoading}
                className="bg-neon-magenta/15 text-neon-magenta ring-neon-magenta/30 hover:bg-neon-magenta/25 w-full rounded-lg py-2.5 font-mono text-sm ring-1 transition-all disabled:cursor-not-allowed disabled:opacity-40"
              >
                {otaLoading ? "Sending OTA command…" : "⬆ Trigger OTA update"}
              </button>
            </div>

            <Feedback msg={otaFeedback} />
          </Card>

          <Card className="border-slate-800/50">
            <p className="mb-2 font-mono text-xs text-slate-500">Tips</p>
            <ul className="space-y-1 font-mono text-xs text-slate-500">
              <li>
                • Upload your <code>.bin</code> to S3 or GitHub Releases and paste the URL above.
              </li>
              <li>• Compile in Arduino IDE: Sketch → Export Compiled Binary.</li>
              <li>
                • Current firmware: <strong className="text-slate-300">v4.0</strong>
              </li>
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
