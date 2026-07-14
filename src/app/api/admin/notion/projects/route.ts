/**
 * /api/admin/notion/projects — backed by AppFlowy
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  listAllWorkspaces,
  listWorkspaceViews,
  createPage,
  AppFlowyNotConfiguredError,
} from "@/lib/appflowy";

interface Project {
  id: string;
  name: string;
  status: string;
  owner: string;
  progress: number;
  url: string;
}

function viewToProject(v: {
  view_id: string;
  name: string;
  layout: string;
  created_at: string;
  last_edited_time: string;
}): Project {
  return {
    id: v.view_id,
    name: v.name,
    status: "In Progress",
    owner: "",
    progress: 0,
    url: `/appflowy/view/${v.view_id}`,
  };
}

async function getPrimaryWorkspaceId(): Promise<string | null> {
  const workspaces = await listAllWorkspaces();
  return workspaces[0]?.workspace_id ?? null;
}

async function getRootViewId(workspaceId: string): Promise<string | null> {
  const views = await listWorkspaceViews(workspaceId);
  return views[0]?.view_id ?? null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const statusFilter = request.nextUrl.searchParams.get("status");

  try {
    const workspaceId = await getPrimaryWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: "No AppFlowy workspace found" }, { status: 503 });
    }

    const views = await listWorkspaceViews(workspaceId);
    let projects = views.filter((v) => v.layout === "Document").map(viewToProject);

    if (statusFilter) {
      projects = projects.filter((p) => p.status === statusFilter);
    }

    return NextResponse.json({ projects, count: projects.length });
  } catch (err) {
    if (err instanceof AppFlowyNotConfiguredError) {
      return NextResponse.json({ error: "AppFlowy not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to list projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body: { name?: string } = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const name = body.name;
    if (typeof name !== "string" || name.length > 200) {
      return NextResponse.json(
        { error: "name must be a non-empty string no longer than 200 characters" },
        { status: 400 }
      );
    }

    const workspaceId = await getPrimaryWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: "No AppFlowy workspace found" }, { status: 503 });
    }

    const rootViewId = await getRootViewId(workspaceId);
    const parentViewId = rootViewId ?? workspaceId;

    const result = await createPage(workspaceId, parentViewId, name);

    return NextResponse.json({ id: result.view_id }, { status: 201 });
  } catch (err) {
    if (err instanceof AppFlowyNotConfiguredError) {
      return NextResponse.json({ error: "AppFlowy not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  // AppFlowy doesn't support status updates via API, acknowledge gracefully
  return NextResponse.json({
    ok: true,
    note: "Status updates are managed inside AppFlowy directly.",
  });
}
