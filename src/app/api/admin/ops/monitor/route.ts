/**
 * Admin - Monitor API proxy
 *
 * Proxies requests to the Pi Alert API (http://192.168.1.128:30800).
 * Exposes three sub-resources via a `resource` query param:
 *   ?resource=status   → GET /api/status   (combined Pi + ESP32 + alert summary)
 *   ?resource=alerts   → GET /api/alerts   (all alerts, optional ?status=active)
 *   ?resource=esp32    → GET /api/esp32/status
 *
 * Only accessible to admins. Falls back gracefully when the Pi is unreachable
 * (e.g. when running on AWS Lambda / cloudless.gr).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

const ALERT_API_URL = process.env.ALERT_API_URL ?? "http://192.168.1.128:30800";

const RESOURCE_MAP: Record<string, string> = {
  status: "/api/status",
  alerts: "/api/alerts",
  esp32: "/api/esp32/status",
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource") ?? "status";
  const path = RESOURCE_MAP[resource];

  if (!path) {
    return NextResponse.json({ error: `Unknown resource: ${resource}` }, { status: 400 });
  }

  // Forward optional query params (e.g. ?status=active for /api/alerts)
  const extra = new URLSearchParams();
  searchParams.forEach((v, k) => {
    if (k !== "resource") extra.set(k, v);
  });
  const qs = extra.toString() ? `?${extra.toString()}` : "";

  try {
    const res = await fetch(`${ALERT_API_URL}${path}${qs}`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Alert API error: HTTP ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unreachable";
    return NextResponse.json(
      { error: `Alert API unreachable: ${msg}`, offline: true },
      { status: 503 }
    );
  }
}
