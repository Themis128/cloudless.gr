/**
 * /api/admin/notion/docs — backed by AppFlowy
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listAllWorkspaces, listWorkspaceViews, AppFlowyNotConfiguredError } from "@/lib/appflowy";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const workspaces = await listAllWorkspaces();
    if (workspaces.length === 0) {
      return NextResponse.json({ error: "No AppFlowy workspace found" }, { status: 503 });
    }

    const workspaceId = workspaces[0].workspace_id;
    const views = await listWorkspaceViews(workspaceId);
    const docs = views
      .filter((v) => v.layout === "Document")
      .map((v) => ({
        id: v.view_id,
        title: v.name,
        created: v.created_at,
        lastEdited: v.last_edited_time,
      }));

    return NextResponse.json({ docs, count: docs.length });
  } catch (err) {
    if (err instanceof AppFlowyNotConfiguredError) {
      return NextResponse.json({ error: "AppFlowy not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to fetch docs" }, { status: 500 });
  }
}
