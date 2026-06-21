/**
 * GET /api/admin/cluster/kuma-status
 * ─────────────────────────────────
 * Admin-gated read of the Uptime Kuma public status page, summarised into
 * a flat `KumaMonitor[]` for the /admin/cluster panel. Single-shot, cached
 * upstream by Kuma — no Cache-Control header needed beyond `no-store` to
 * keep the chip fresh.
 *
 * Returns 200 with `{ summary: KumaSummary | null }` — null when Kuma is
 * unreachable / slug missing / not yet configured. Never 5xx on broker
 * issues; the UI renders a "configure" / "down" pill from the null.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getKumaSummary } from "@/lib/kuma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const summary = await getKumaSummary(5000);
  return NextResponse.json({ summary }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
