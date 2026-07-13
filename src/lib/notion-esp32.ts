/**
 * Notion ESP32 device mirror.
 *
 * Mirrors hardware state and significant alerts from the Pi Alert API into a
 * Notion database so the app stays useful even when the cluster is offline.
 *
 * DB schema (one row per device; one row per alert):
 *   Devices DB  → NOTION_ESP32_DEVICES_DB_ID
 *     Name (title)            — human readable, e.g. "ESP32 Alert Manager"
 *     Device ID (rich_text)
 *     IP (rich_text)
 *     Firmware (rich_text)
 *     RSSI (number)
 *     Free RAM (number)        — bytes
 *     Uptime (number)          — seconds
 *     Last Heartbeat (date)
 *     Status (select)          — Online | Stale | Offline
 *
 *   Telemetry DB → NOTION_ESP32_TELEMETRY_DB_ID  (optional; for log/alert mirroring)
 *     Code (title)             — e.g. "ESP32_LOW_RAM"
 *     Severity (select)        — critical | high | medium | low | info
 *     Message (rich_text)
 *     Status (select)          — ACTIVE | RESOLVED
 *     First seen (date)
 *     Last seen (date)
 *
 * Both databases are optional — the helpers degrade to no-ops when the env
 * vars are absent so the app keeps working without Notion ESP32 wiring.
 */

import { notionFetch } from "@/lib/notion";
import { getIntegrationsAsync } from "@/lib/integrations";

// ---------------------------------------------------------------------------
// Types — mirror the shape returned by the Pi Alert API
// ---------------------------------------------------------------------------

export interface Esp32Status {
  id?: number;
  ip: string | null;
  rssi: number | null;
  firmware_ver: string | null;
  uptime_s: number | null;
  free_ram_bytes: number | null;
  last_heartbeat: string | null;
  started_at?: string | null;
  device_id: string | null;
  stale: boolean;
}

export interface Esp32Alert {
  id?: number;
  code: string;
  host: string;
  service?: string;
  severity: string;
  message: string;
  status: string;
  count?: number;
  first_seen: string;
  last_seen: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
}

export interface Esp32NotionConfig {
  devicesDbId?: string;
  telemetryDbId?: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export async function getEsp32NotionConfig(): Promise<Esp32NotionConfig> {
  // Read directly from env first so we don't force a strict integrations
  // schema update for an optional feature.
  const fromEnv = {
    devicesDbId: process.env.NOTION_ESP32_DEVICES_DB_ID,
    telemetryDbId: process.env.NOTION_ESP32_TELEMETRY_DB_ID,
  };
  if (fromEnv.devicesDbId || fromEnv.telemetryDbId) return fromEnv;

  // Fallback: in case the values move into the integrations module later.
  try {
    const integ = (await getIntegrationsAsync()) as Record<string, string | undefined>;
    return {
      devicesDbId: integ.NOTION_ESP32_DEVICES_DB_ID,
      telemetryDbId: integ.NOTION_ESP32_TELEMETRY_DB_ID,
    };
  } catch {
    return {};
  }
}

export function isEsp32NotionConfigured(cfg: Esp32NotionConfig): boolean {
  return Boolean(cfg.devicesDbId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusLabel(s: Esp32Status): "Online" | "Stale" | "Offline" {
  if (!s.last_heartbeat) return "Offline";
  return s.stale ? "Stale" : "Online";
}

function isoOrNull(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface NotionQueryResponse {
  results?: Array<{ id: string }>;
}

async function findDevicePageByDeviceId(dbId: string, deviceId: string): Promise<string | null> {
  const body = {
    filter: {
      property: PROP_DEVICE_ID,
      rich_text: { equals: deviceId },
    },
    page_size: 1,
  };
  const res = await notionFetch<NotionQueryResponse>(`/databases/${dbId}/query`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.results?.[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upsert a single device row in the Notion devices DB.
 *
 * Lookup key: `Device ID` (rich_text). If no row exists, a new page is
 * created; otherwise the existing page is patched. Returns the Notion page id
 * (or null when the feature is not configured).
 */
export async function upsertEsp32DeviceInNotion(status: Esp32Status): Promise<string | null> {
  const cfg = await getEsp32NotionConfig();
  if (!cfg.devicesDbId) return null;
  if (!status.device_id) return null; // can't upsert without a key

  const heartbeat = isoOrNull(status.last_heartbeat);
  const properties: Record<string, unknown> = {
    Name: {
      title: [{ text: { content: `ESP32 ${status.device_id}` } }],
    },
    [PROP_DEVICE_ID]: {
      rich_text: [{ text: { content: status.device_id } }],
    },
    IP: {
      rich_text: status.ip ? [{ text: { content: status.ip } }] : [],
    },
    Firmware: {
      rich_text: status.firmware_ver ? [{ text: { content: status.firmware_ver } }] : [],
    },
    RSSI: { number: status.rssi },
    [PROP_FREE_RAM]: { number: status.free_ram_bytes },
    Uptime: { number: status.uptime_s },
    [PROP_LAST_HEARTBEAT]: heartbeat != null ? { date: { start: heartbeat } } : { date: null },
    Status: { select: { name: statusLabel(status) } },
  };

  const existing = await findDevicePageByDeviceId(cfg.devicesDbId, status.device_id);

  if (existing) {
    const updated = await notionFetch<{ id: string }>(`/pages/${existing}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });
    return updated.id;
  }

  const created = await notionFetch<{ id: string }>(`/pages`, {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: cfg.devicesDbId },
      properties,
    }),
  });
  return created.id;
}

/**
 * Append a telemetry / alert row to the optional telemetry DB.
 *
 * No-op when NOTION_ESP32_TELEMETRY_DB_ID isn't configured. We don't dedupe
 * here — callers are expected to forward only significant transitions
 * (alert raised / resolved), not every heartbeat.
 */
export async function appendEsp32TelemetryToNotion(alert: Esp32Alert): Promise<string | null> {
  const cfg = await getEsp32NotionConfig();
  if (!cfg.telemetryDbId) return null;

  const firstSeen = isoOrNull(alert.first_seen);
  const lastSeen = isoOrNull(alert.last_seen);
  const created = await notionFetch<{ id: string }>(`/pages`, {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: cfg.telemetryDbId },
      properties: {
        Code: {
          title: [{ text: { content: alert.code } }],
        },
        Severity: { select: { name: alert.severity || "info" } },
        Message: {
          rich_text: [{ text: { content: alert.message.slice(0, 2000) } }],
        },
        Status: { select: { name: alert.status || "ACTIVE" } },
        [PROP_FIRST_SEEN]: firstSeen != null ? { date: { start: firstSeen } } : { date: null },
        [PROP_LAST_SEEN]: lastSeen != null ? { date: { start: lastSeen } } : { date: null },
      },
    }),
  });
  return created.id;
}

interface NotionPage {
  id: string;
  url?: string;
  properties?: Record<string, unknown>;
}

/**
 * Read the latest device snapshot from Notion. Used as a fallback display
 * when the Alert API is unreachable so the admin page still shows something
 * useful (last known state) instead of an error.
 */
export async function readEsp32DevicesFromNotion(): Promise<Esp32Status[]> {
  const cfg = await getEsp32NotionConfig();
  if (!cfg.devicesDbId) return [];

  const res = await notionFetch<{ results?: NotionPage[] }>(`/databases/${cfg.devicesDbId}/query`, {
    method: "POST",
    body: JSON.stringify({
      sorts: [{ property: "Last Heartbeat", direction: "descending" }],
      page_size: 25,
    }),
  });

  return (res.results ?? []).map((page) => mapDevicePage(page));
}

// Property key constants — avoids S1192 duplicate-string violations.
const PROP_DEVICE_ID = "Device ID";
const PROP_FREE_RAM = "Free RAM";
const PROP_LAST_HEARTBEAT = "Last Heartbeat";
const PROP_FIRST_SEEN = "First seen";
const PROP_LAST_SEEN = "Last seen";

 
function mapDevicePage(page: any): Esp32Status {
  const p = page.properties ?? {};
  const richText = (v: unknown): string | null => {
    const arr = (v as { rich_text?: Array<{ plain_text?: string }> })?.rich_text;
    if (!arr?.length) return null;
    return arr.map((t) => t.plain_text ?? "").join("") || null;
  };
  return {
    device_id: richText(p[PROP_DEVICE_ID]),
    ip: richText(p.IP),
    firmware_ver: richText(p.Firmware),
    rssi: p.RSSI?.number ?? null,
    free_ram_bytes: p[PROP_FREE_RAM]?.number ?? null,
    uptime_s: p.Uptime?.number ?? null,
    last_heartbeat: p[PROP_LAST_HEARTBEAT]?.date?.start ?? null,
    stale: p.Status?.select?.name === "Stale",
  };
}
