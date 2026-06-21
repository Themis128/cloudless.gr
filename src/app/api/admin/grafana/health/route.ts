/**
 * GET /api/admin/grafana/health
 * ────────────────────────────
 * Admin-gated chip data for /admin/grafana: returns `configured` + `healthy`
 * so the UI can render the live status pill without exposing the API token.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isGrafanaConfigured, pingGrafana } from "@/lib/grafana";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const configured = await isGrafanaConfigured();
  const healthy = configured ? await pingGrafana() : false;
  return NextResponse.json(
    { configured, healthy },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
