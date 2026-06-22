import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { notificationAnalytics } from "@/lib/admin-notifications";

const DEFAULT_WINDOW_DAYS = 7;

function parseIso(raw: string | null): string | undefined {
  if (!raw) return undefined;
  return Number.isFinite(Date.parse(raw)) ? raw : undefined;
}

/**
 * GET /api/admin/notifications/analytics
 *   ?since=<ISO 8601, default = now - 7 days>
 *   ?until=<ISO 8601, default = now>
 *
 * Returns aggregate counts for the admin dashboard panel:
 *   { window: { since, until }, total, byCategory: {...}, byDay: {...} }
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!process.env.ADMIN_NOTIFICATIONS_TABLE) {
    return NextResponse.json({ error: "Notifications store not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const sinceParam = parseIso(url.searchParams.get("since"));
  const untilParam = parseIso(url.searchParams.get("until"));

  const until = untilParam ?? new Date().toISOString();
  const since =
    sinceParam ?? new Date(Date.now() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    const stats = await notificationAnalytics({ since, until });
    return NextResponse.json({ window: { since, until }, ...stats });
  } catch (err) {
    console.error("[admin-notifications] analytics failed:", err);
    return NextResponse.json({ error: "Failed to compute analytics" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
