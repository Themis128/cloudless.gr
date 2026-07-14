/**
 * /api/admin/notion/analytics — backed by Athena (via notion-analytics)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isConfiguredAsync } from "@/lib/integrations";
import {
  getAnalyticsSummary,
  getRecentEvents,
  createWeeklyRollup,
  archiveOldEvents,
} from "@/lib/notion-analytics";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  // Check configuration
  const configured = await isConfiguredAsync("NOTION_API_KEY", "NOTION_ANALYTICS_DB_ID");
  if (!configured) {
    return NextResponse.json({ error: "Notion not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? 7);

  try {
    // Check if type param provided for filtered events
    const type = searchParams.get("type") as
      "page_view" | "form_submit" | "blog_view" | "doc_view" | "signup" | "order" | "error" | null;

    if (type) {
      const events = await getRecentEvents(type);
      return NextResponse.json({ events });
    }

    const summary = await getAnalyticsSummary(days);
    return NextResponse.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[Notion Analytics] Failed to fetch analytics:", msg);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body: { action?: string; daysToKeep?: number } = await request.json();

    if (!body.action) {
      return NextResponse.json({ error: "action required" }, { status: 400 });
    }

    const { action } = body;
    if (action === "rollup") {
      const rollupId = await createWeeklyRollup();
      return NextResponse.json({ ok: true, rollupId });
    }

    if (action === "archive") {
      const result = await archiveOldEvents(body.daysToKeep ?? 90);
      return NextResponse.json({ ok: true, archived: result.archived });
    }

    if (action === "maintain") {
      const rollupId = await createWeeklyRollup();
      const result = await archiveOldEvents(body.daysToKeep ?? 90);
      return NextResponse.json({ ok: true, rollupId, archived: result.archived });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[Notion Analytics] Failed:", msg);
    return NextResponse.json({ error: "Failed to process action" }, { status: 500 });
  }
}
