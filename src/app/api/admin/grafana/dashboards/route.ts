/**
 * GET /api/admin/grafana/dashboards
 * ────────────────────────────────
 * Admin-gated list of Grafana dashboards via `src/lib/grafana.ts`. Used by
 * the /admin/grafana page card grid.
 *
 * Returns `{ dashboards: [], configured: false }` when GRAFANA_API_TOKEN
 * isn't set — UI shows a "configure me" placeholder rather than a 500.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { GrafanaNotConfiguredError, isGrafanaConfigured, listDashboards } from "@/lib/grafana";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const configured = await isGrafanaConfigured();
  if (!configured) {
    return NextResponse.json(
      { dashboards: [], configured: false },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  try {
    const dashboards = await listDashboards();
    return NextResponse.json(
      { dashboards, configured: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    if (err instanceof GrafanaNotConfiguredError) {
      return NextResponse.json({ dashboards: [], configured: false }, { status: 503 });
    }
    return NextResponse.json(
      { error: "grafana_upstream_failed", detail: (err as Error).message },
      { status: 502 }
    );
  }
}
