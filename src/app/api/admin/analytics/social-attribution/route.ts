import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getAuthDbFromEnv } from "@/lib/auth-d1";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const days = Math.min(Number(url.searchParams.get("days") || "90"), 365);
  const since = Math.floor((Date.now() - days * 86400_000) / 1000);

  const db = getAuthDbFromEnv();
  if (!db) {
    return NextResponse.json({ error: "analytics_db_unavailable" }, { status: 503 });
  }

  const result = await db
    .prepare(
      `SELECT COALESCE(source, '(direct)') AS utm_source,
              COALESCE(campaign, '(none)') AS utm_campaign,
              COALESCE(json_extract(properties_json, '$.utm_content'), '(none)') AS platform,
              COUNT(DISTINCT CASE WHEN event = 'page_view' THEN session_id END) AS sessions,
              COUNT(DISTINCT CASE WHEN event = 'signup' THEN user_id END) AS signups,
              COUNT(DISTINCT CASE WHEN event = 'contact_form' THEN session_id END) AS leads,
              SUM(CASE WHEN event = 'purchase' THEN 1 ELSE 0 END) AS purchases,
              SUM(CASE WHEN event = 'purchase'
                       THEN COALESCE(json_extract(properties_json, '$.amount'), 0)
                       ELSE 0 END) AS revenue
       FROM analytics_events
       WHERE created_at >= ?
         AND medium = 'social'
       GROUP BY 1, 2, 3
       ORDER BY sessions DESC
       LIMIT 50`
    )
    .bind(since)
    .all<Record<string, string | number | null>>();

  const rows = result.results ?? [];

  const totalSessions = rows.reduce((s, r) => s + Number(r.sessions ?? 0), 0);
  const totalLeads = rows.reduce((s, r) => s + Number(r.leads ?? 0), 0);
  const totalSignups = rows.reduce((s, r) => s + Number(r.signups ?? 0), 0);
  const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue ?? 0), 0);

  return NextResponse.json({
    rows,
    totals: {
      sessions: totalSessions,
      leads: totalLeads,
      signups: totalSignups,
      revenue: totalRevenue,
      conversionRate: totalSessions > 0 ? ((totalLeads + totalSignups) / totalSessions) * 100 : 0,
    },
    days,
  });
}
