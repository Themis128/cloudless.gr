import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  isPostizConfigured,
  listIntegrations,
  PostizApiError,
  PostizNotConfiguredError,
} from "@/lib/postiz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/postiz/health — JSON + Prometheus-flavoured metrics.
 *
 * Default JSON shape: `{ ok, configured, integrations, disabled, latencyMs, error? }`.
 * Pass `?format=prom` to get a text/plain `# TYPE / # HELP` exposition
 * suitable for a Prometheus scrape config — small enough to leave on the
 * admin surface without a dedicated /metrics endpoint, large enough to alert
 * on "no connected channels" or "high upstream latency".
 */
const METRIC_NAMES = {
  up: "postiz_up",
  channels: "postiz_integrations_total",
  disabled: "postiz_integrations_disabled_total",
  latency: "postiz_request_latency_ms",
} as const;

function asProm(snapshot: {
  configured: boolean;
  ok: boolean;
  integrations: number;
  disabled: number;
  latencyMs: number;
}): string {
  const lines = [
    `# HELP ${METRIC_NAMES.up} 1 if Postiz reachable and authenticated, 0 otherwise.`,
    `# TYPE ${METRIC_NAMES.up} gauge`,
    `${METRIC_NAMES.up} ${snapshot.ok ? 1 : 0}`,
    `# HELP ${METRIC_NAMES.channels} Connected Postiz integrations (all states).`,
    `# TYPE ${METRIC_NAMES.channels} gauge`,
    `${METRIC_NAMES.channels} ${snapshot.integrations}`,
    `# HELP ${METRIC_NAMES.disabled} Connected Postiz integrations with disabled=true.`,
    `# TYPE ${METRIC_NAMES.disabled} gauge`,
    `${METRIC_NAMES.disabled} ${snapshot.disabled}`,
    `# HELP ${METRIC_NAMES.latency} Round-trip latency of the integrations probe, in ms.`,
    `# TYPE ${METRIC_NAMES.latency} gauge`,
    `${METRIC_NAMES.latency} ${snapshot.latencyMs}`,
  ];
  return `${lines.join("\n")}\n`;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const format = new URL(req.url).searchParams.get("format");

  const configured = await isPostizConfigured();
  if (!configured) {
    const snapshot = {
      ok: false,
      configured: false,
      integrations: 0,
      disabled: 0,
      latencyMs: 0,
    };
    if (format === "prom") {
      return new NextResponse(asProm(snapshot), {
        status: 200,
        headers: { "Content-Type": "text/plain; version=0.0.4" },
      });
    }
    return NextResponse.json({ ...snapshot, error: "postiz_not_configured" }, { status: 404 });
  }

  const startedAt = Date.now();
  try {
    const integrations = await listIntegrations();
    const latencyMs = Date.now() - startedAt;
    const disabled = integrations.filter((i) => i.disabled).length;
    const snapshot = {
      ok: true,
      configured: true,
      integrations: integrations.length,
      disabled,
      latencyMs,
    };
    if (format === "prom") {
      return new NextResponse(asProm(snapshot), {
        status: 200,
        headers: { "Content-Type": "text/plain; version=0.0.4" },
      });
    }
    return NextResponse.json(snapshot);
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const snapshot = { ok: false, configured: true, integrations: 0, disabled: 0, latencyMs };
    if (err instanceof PostizNotConfiguredError) {
      if (format === "prom") {
        return new NextResponse(asProm({ ...snapshot, configured: false }), {
          status: 200,
          headers: { "Content-Type": "text/plain; version=0.0.4" },
        });
      }
      return NextResponse.json(
        { ...snapshot, configured: false, error: "postiz_not_configured" },
        { status: 404 }
      );
    }
    if (err instanceof PostizApiError) {
      if (format === "prom") {
        return new NextResponse(asProm(snapshot), {
          status: 200,
          headers: { "Content-Type": "text/plain; version=0.0.4" },
        });
      }
      return NextResponse.json(
        { ...snapshot, error: "postiz_upstream", status: err.status, body: err.body },
        { status: 502 }
      );
    }
    throw err;
  }
}
