import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getAnalyticsSummary, getRecentEvents, createWeeklyRollup, archiveOldEvents } from "@/lib/notion-analytics";
import type { AnalyticsEventType } from "@/lib/notion-analytics";
import { isConfigured } from "@/lib/integrations";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!isConfigured("NOTION_API_KEY", "NOTION_ANALYTICS_DB_ID")) {
    return NextResponse.json({ error: "Notion Analytics not configured" }, { status: 503 });
  }

  const _rawDays = parseInt(request.nextUrl.searchParams.get("days") ?? "7", 10);
  const days = Math.max(1, Math.min(isNaN(_rawDays) ? 7 : _rawDays, 365));
  const type = request.nextUrl.searchParams.get("type") as AnalyticsEventType | null;

  if (type) {
    const events = await getRecentEvents(type);
    return NextResponse.json({ events, count: events.length });
  }

  const summary = await getAnalyticsSummary(days);
  return NextResponse.json(summary);
}

/**
 * POST /api/admin/notion/analytics
 *
 * Actions:
 *   { action: "rollup" }   → Create a weekly rollup entry
 *   { action: "archive" }  → Archive old granular events (default 30 days)
 *   { action: "maintain" } → Rollup + archive in one call
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!isConfigured("NOTION_API_KEY", "NOTION_ANALYTICS_DB_ID")) {
    return NextResponse.json({ error: "Notion Analytics not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action as string;
  const _rawDtk = typeof body.daysToKeep === "number" ? body.daysToKeep : 30;
  const daysToKeep = Math.max(1, Math.min(isNaN(_rawDtk) ? 30 : _rawDtk, 3650));

  if (action === "rollup") {
    const rollupId = await createWeeklyRollup();
    return NextResponse.json({ ok: true, rollupId });
  }

  if (action === "archive") {
    const result = await archiveOldEvents(daysToKeep);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "maintain") {
    const rollupId = await createWeeklyRollup();
    const archiveResult = await archiveOldEvents(daysToKeep);
    return NextResponse.json({ ok: true, rollupId, ...archiveResult });
  }

  return NextResponse.json(
    { error: 'Unknown action. Use "rollup", "archive", or "maintain".' },
    { status: 400 },
  );
}
