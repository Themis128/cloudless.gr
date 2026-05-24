import { requireAdmin } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";

const ALERT_API = process.env.ALERT_API_URL ?? "http://192.168.1.128:30800";

async function proxyRequest(path: string, init?: RequestInit): Promise<NextResponse> {
  try {
    const res = await fetch(`${ALERT_API}${path}`, {
      ...init,
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) {
      return NextResponse.json({ error: "ESP32 management unavailable", offline: true }, { status: 503 });
    }
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Pi unreachable", offline: true }, { status: 503 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action");
  const deviceId = searchParams.get("device_id") ?? "esp32-leds";

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
        const raw = await res.json();
        // Pi /api/esp32/status returns { id, ip, rssi, ... } but the
        // frontend expects device_id.  Map the fields so the device
        // table renders correctly.
        const device = {
          device_id: raw.id != null ? `esp32-${raw.id}` : "esp32-leds",
          ip: raw.ip,
          rssi: raw.rssi,
          firmware_ver: raw.firmware_ver,
          uptime_s: raw.uptime_s,
          free_ram_bytes: raw.free_ram_bytes,
          last_heartbeat: raw.last_heartbeat,
          stale: raw.stale ?? true,
        };
        return NextResponse.json([device]);
      } catch {
        return NextResponse.json({ error: "Pi unreachable", offline: true }, { status: 503 });
      }
    }
    case "config":  return proxyRequest(`/api/esp32/${deviceId}/config`);
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action");
  const deviceId = searchParams.get("device_id") ?? "esp32-leds";
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

  const { searchParams } = request.nextUrl;
  const deviceId = searchParams.get("device_id") ?? "esp32-leds";
  const body = await request.text();

  return proxyRequest(`/api/esp32/${deviceId}/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}