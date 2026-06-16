import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { aggregateAllWorkspaceAnalytics } from "@/lib/workspace-analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/analytics/workspaces — denormalised per-workspace summary
 *  joining workspaces SSM + client-portals SSM + Notion calendar in one pass.
 *
 *  Response shape:
 *    {
 *      workspaces: WorkspaceAnalytics[],
 *      orgWide:    WorkspaceAnalytics      // portals/calendar with no workspaceId
 *    }
 *
 *  Use for dashboards that need a quick "how is each tenant doing" snapshot. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const data = await aggregateAllWorkspaceAnalytics();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[analytics/workspaces] failed:", err);
    return NextResponse.json({ error: "analytics_failed" }, { status: 502 });
  }
}
