/**
 * /api/admin/appflowy/docs — backed by AppFlowy
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  listAllWorkspaces,
  listWorkspaceViews,
  AppFlowyNotConfiguredError,
} from "@/lib/appflowy";

interface DocPage {
  id: string;
  title: string;
  slug: string;
  lastEdited: string;
  url: string;
}

async function getPrimaryWorkspaceId(): Promise<string | null> {
  const workspaces = await listAllWorkspaces();
  return workspaces[0]?.workspace_id ?? null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const workspaceId = await getPrimaryWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: "No AppFlowy workspace found" }, { status: 503 });
    }

    const views = await listWorkspaceViews(workspaceId);
    const docs: DocPage[] = views.map((v) => ({
      id: v.view_id,
      title: v.name,
      slug: v.name.toLowerCase().replace(/\s+/g, "-"),
      lastEdited: v.last_edited_time,
      url: `/appflowy/view/${v.view_id}`,
    }));

    return NextResponse.json({ docs, count: docs.length });
  } catch (err) {
    if (err instanceof AppFlowyNotConfiguredError) {
      return NextResponse.json({ error: "AppFlowy not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to list docs" }, { status: 500 });
  }
}