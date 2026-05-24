import { requireAdmin } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";

const ALERT_API = process.env.ALERT_API_URL ?? "http://192.168.1.128:30800";

async function proxyRequest(path: string, init?: RequestInit): Promise<NextResponse> {
  try {
    const res = await fetch(`${ALERT_API}${path}`, {
      ...init,
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Pi unreachable", offline: true }, { status: 503 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authErr = await requireAdmin(request);
  if (authErr) return authErr;

  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action");
  const deviceId = searchParams.get("device_id") ?? "esp32-leds";

  switch (action) {
    case "devices": return proxyRequest("/api/esp32/devices");
    case "config":  return proxyRequest(`/api/esp32/${deviceId}/config`);
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authErr = await requireAdmin(request);
  if (authErr) return authErr;

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
  const authErr = await requireAdmin(request);
  if (authErr) return authErr;

  const { searchParams } = request.nextUrl;
  const deviceId = searchParams.get("device_id") ?? "esp32-leds";
  const body = await request.text();

  return proxyRequest(`/api/esp32/${deviceId}/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}