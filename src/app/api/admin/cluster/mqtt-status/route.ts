/**
 * GET /api/admin/cluster/mqtt-status
 * ─────────────────────────────────
 * Read-once snapshot of the live `homelab/alerts/status` retained MQTT
 * payload. Used by the `/admin/cluster` page chip — single network read
 * per page load, no long-lived subscription. Falls back to `null` on any
 * failure (broker unreachable, lib not installed, no retained message
 * yet) so the chip degrades to "—" instead of an error.
 *
 * Auth: requireAdmin (same gate as the rest of /api/admin/cluster/*).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { readLatestAlertStatus } from "@/lib/mqtt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const status = await readLatestAlertStatus(3000);
  return NextResponse.json({ status }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
