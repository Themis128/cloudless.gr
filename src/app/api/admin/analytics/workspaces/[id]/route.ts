import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { aggregateWorkspaceAnalytics } from "@/lib/workspace-analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/analytics/workspaces/:id — detailed analytics for one
 *  workspace, joining portals + calendar + revenue. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  try {
    const data = await aggregateWorkspaceAnalytics(id);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[analytics/workspaces/:id] failed:", err);
    return NextResponse.json({ error: "analytics_failed" }, { status: 502 });
  }
}
