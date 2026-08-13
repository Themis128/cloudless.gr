import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getGoldSection, getKpiFromLake, getInsight } from "@/lib/datalake-serve";

/**
 * Admin KPI tile — lake gold SEO/revenue/funnel + optional executive insight.
 * No live GSC / Notion.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const days = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("days") ?? "28"), 365 * 2)
  );

  const [kpi, appflowy, executive] = await Promise.all([
    getKpiFromLake(days),
    getGoldSection("appflowy_activity"),
    getInsight("executive"),
  ]);

  return NextResponse.json({
    source: "datalake-gold",
    analytics: {
      pageViews: null,
      note: "Legacy Notion analytics decommissioned — use datalake acquisition_funnel.",
    },
    gsc: kpi.seo,
    revenue: { rows: kpi.revenueRows },
    funnel: { rows: kpi.funnelRows },
    projects: {
      total: appflowy?.rowCount ?? 0,
      byStatus: {},
      activeCount: appflowy?.rowCount ?? 0,
      rows: appflowy?.rows?.slice(0, 20) ?? [],
      error: appflowy?.error,
    },
    tasks: {
      summary: {},
      overdueCount: 0,
      note: "Task KPIs come from appflowy_activity gold when present.",
    },
    insight: executive
      ? { summary: executive.summary, bullets: executive.bullets, generated_at: executive.generated_at }
      : null,
    errors: kpi.errors,
    fetchedAt: kpi.fetchedAt,
  });
}
