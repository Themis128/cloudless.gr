import { requireAdmin } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";

const ALERT_API = process.env.ALERT_API_URL ?? "http://192.168.1.128:30800";

/**
 * Device IDs are short slugs. Validate before interpolating into the upstream
 * proxy URL so a crafted `device_id` (path traversal, encoded slashes) can't
 * alter the request target. Falls back to the default on anything invalid.
 */
function safeDeviceId(raw: string | null): string {
  const id = raw ?? "esp32-leds";
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id) ? id : "esp32-leds";
}

function isPrivateLanUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") ||
      hostname === "localhost" ||
      hostname === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

async function proxyRequest(path: string, init?: RequestInit): Promise<NextResponse> {
  try {
    const res = await fetch(`${ALERT_API}${path}`, {
      ...init,
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) {
      return NextResponse.json(
        { error: "ESP32 management unavailable", offline: true },
        { status: 503 }
      );
    }
    const data: unknown = (await res.json()) as any;
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Pi unreachable", offline: true }, { status: 503 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (isPrivateLanUrl(ALERT_API)) {
    return NextResponse.json(
      { error: "ESP32 API not reachable from this deployment", offline: true },
      { status: 503 }
    );
  }

  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action");
  const deviceId = safeDeviceId(searchParams.get("device_id"));

  switch (action) {
    case "devices": {
      // The Pi alert API exposes /api/esp32/status (single device) but not
      // /api/esp32/devices (list). Fetch the single status and wrap as an array.
      try {
        const res = await fetch(`${ALERT_API}/api/esp32/status`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          return NextResponse.json({ error: "No ESP32 devices found" }, { status: 404 });
        }
        const rawUntyped: unknown = (await res.json()) as any;
        // Pi /api/esp32/status returns { id, device_id, ip, rssi, ... }.
        // Prefer the explicit device_id field; fall back to synthesising
        // from id only when both are absent (older firmware).
        const statusData = rawUntyped as Record<string, unknown>;
        const deviceIdVal =
          typeof statusData.device_id === "string" && statusData.device_id
            ? statusData.device_id
            : statusData.id != null
              ? `esp32-${statusData.id}`
              : "esp32-unknown";
        const device = {
          device_id: deviceIdVal,
          ip: statusData.ip ?? null,
          rssi: statusData.rssi ?? null,
          firmware_ver: statusData.firmware_ver ?? null,
          uptime_s: statusData.uptime_s ?? null,
          free_ram_bytes: statusData.free_ram_bytes ?? null,
          last_heartbeat: statusData.last_heartbeat ?? null,
          stale: typeof statusData.stale === "boolean" ? statusData.stale : true,
        };
        return NextResponse.json([device]);
      } catch {
        return NextResponse.json({ error: "Pi unreachable", offline: true }, { status: 503 });
      }
    }
    case "config":
      return proxyRequest(`/api/esp32/${deviceId}/config`);
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (isPrivateLanUrl(ALERT_API)) {
    return NextResponse.json(
      { error: "ESP32 API not reachable from this deployment", offline: true },
      { status: 503 }
    );
  }

  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action");
  const deviceId = safeDeviceId(searchParams.get("device_id"));
  const body = await request.text();
  const headers = { "Content-Type": "application/json" };

  switch (action) {
    case "command":
      return proxyRequest(`/api/esp32/${deviceId}/command`, { method: "POST", headers, body });
    case "ota":
      return proxyRequest("/api/esp32/ota", { method: "POST", headers, body });
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (isPrivateLanUrl(ALERT_API)) {
    return NextResponse.json(
      { error: "ESP32 API not reachable from this deployment", offline: true },
      { status: 503 }
    );
  }

  const { searchParams } = request.nextUrl;
  const deviceId = safeDeviceId(searchParams.get("device_id"));
  const body = await request.text();

  return proxyRequest(`/api/esp32/${deviceId}/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
