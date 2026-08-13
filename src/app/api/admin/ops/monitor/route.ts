/**
 * Admin - Monitor API proxy
 *
 * Proxies requests to the Pi Alert API. The target URL is set via
 * ALERT_API_URL env var; when unset it defaults to the in-cluster
 * Service DNS (alert-api.alert-manager.svc.cluster.local:8080).
 *
 * If ALERT_API_URL points at a private LAN IP (legacy Lambda/cloud
 * configs), the route returns {offline:true} immediately rather than
 * hanging — the Pi app should use the cluster Service URL instead.
 *
 * Sub-resources (via ?resource=):
 *   status   → GET /api/status
 *   alerts   → GET /api/alerts
 *   esp32    → GET /api/esp32/status
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

// In-cluster default (Pi k3s). Override via ALERT_API_URL. Private LAN
// defaults are rejected by isPrivateLanUrl below for non-cluster deploys.
const ALERT_API_URL =
  process.env.ALERT_API_URL ?? "http://alert-api.alert-manager.svc.cluster.local:8080";

const RESOURCE_MAP: Record<string, string> = {
  status: "/api/status",
  alerts: "/api/alerts",
  esp32: "/api/esp32/status",
};

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

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  // On any deployment where the Pi is behind a private LAN IP it's unreachable.
  if (isPrivateLanUrl(ALERT_API_URL)) {
    return NextResponse.json(
      { error: "Alert API not reachable from this deployment", offline: true },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource") ?? "status";
  const path = RESOURCE_MAP[resource];

  if (!path) {
    return NextResponse.json({ error: `Unknown resource: ${resource}` }, { status: 400 });
  }

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

    const data: unknown = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[ops/monitor] Alert API unreachable:", err);
    return NextResponse.json({ error: "Alert API unreachable", offline: true }, { status: 503 });
  }
}
