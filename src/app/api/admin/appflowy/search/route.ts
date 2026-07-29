/**
 * /api/admin/appflowy/search — backed by AppFlowy
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  listAllWorkspaces,
  searchDocuments,
  listAllUsers,
  AppFlowyNotConfiguredError,
} from "@/lib/appflowy";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const type = searchParams.get("type");
  const _limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

  try {
    if (type === "users") {
      const users = await listAllUsers();
      return NextResponse.json({ users });
    }

    const workspaces = await listAllWorkspaces();
    const workspaceId = workspaces[0]?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: "No AppFlowy workspace found" }, { status: 404 });
    }

    if (!q) {
      return NextResponse.json({ results: [], total: 0 });
    }

    const views = await searchDocuments(workspaceId, q);
    const results = views.map((v) => ({
      id: v.view_id,
      title: v.name,
      type: v.type,
      lastEdited: v.last_edited_time,
      url: `/appflowy/view/${v.view_id}`,
    }));

    return NextResponse.json({ results, total: results.length });
  } catch (err) {
    if (err instanceof AppFlowyNotConfiguredError) {
      return NextResponse.json({ error: "AppFlowy not configured" }, { status: 404 });
    }
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
