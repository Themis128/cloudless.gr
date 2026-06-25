/**
 * /api/admin/notion/docs — backed by AppFlowy workspace documents.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listAllWorkspaces, listWorkspaceViews, AppFlowyNotConfiguredError } from "@/lib/appflowy";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const workspaces = await listAllWorkspaces();
    const workspaceId = workspaces[0]?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: "No AppFlowy workspace found" }, { status: 503 });
    }

    const views = await listWorkspaceViews(workspaceId);
    const docs = views
      .filter((v) => v.layout === "Document")
      .map((v) => ({
        id: v.view_id,
        title: v.name,
        lastEdited: v.last_edited_time,
        createdAt: v.created_at,
        url: `/appflowy/view/${v.view_id}`,
      }));

    return NextResponse.json({ docs, count: docs.length });
  } catch (err) {
    if (err instanceof AppFlowyNotConfiguredError) {
      return NextResponse.json({ error: "AppFlowy not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to list documents" }, { status: 500 });
  }
}
