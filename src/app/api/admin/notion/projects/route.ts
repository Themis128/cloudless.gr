/**
 * /api/admin/notion/projects — backed by AppFlowy (self-hosted Notion replacement).
 *
 * AppFlowy doesn't have a typed "Projects database" — projects are Document
 * pages inside a workspace. The route maps AppFlowy views to the existing
 * Project shape so the admin UI keeps working unchanged.
 *
 * Falls back to 503 when AppFlowy is not configured rather than crashing.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  listAllWorkspaces,
  listWorkspaceViews,
  createPage,
  AppFlowyNotConfiguredError,
} from "@/lib/appflowy";
import type { AppFlowyView } from "@/lib/appflowy";
import type { Project, ProjectStatus } from "@/lib/notion-projects";

function viewToProject(v: AppFlowyView): Project {
  return {
    id: v.view_id,
    name: v.name,
    status: "In Progress" as ProjectStatus,
    priority: "Medium",
    type: "Internal",
    owner: "",
    startDate: v.created_at,
    dueDate: "",
    description: "",
    budget: null,
    progress: 0,
    tags: [],
    url: `/appflowy/view/${v.view_id}`,
  };
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

    const statusFilter = request.nextUrl.searchParams.get("status") as ProjectStatus | null;
    const views = await listWorkspaceViews(workspaceId);
    const projects = views.filter((v) => v.layout === "Document").map(viewToProject);
    const filtered = statusFilter ? projects.filter((p) => p.status === statusFilter) : projects;

    return NextResponse.json({ projects: filtered, count: filtered.length });
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 200) {
    return NextResponse.json(
      { error: "name must be a non-empty string no longer than 200 characters" },
      { status: 400 }
    );
  }

  try {
    const workspaceId = await getPrimaryWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: "No AppFlowy workspace found" }, { status: 503 });
    }

    const views = await listWorkspaceViews(workspaceId);
    const rootId = views[0]?.view_id;
    if (!rootId) {
      return NextResponse.json({ error: "Workspace has no root view" }, { status: 503 });
    }

    const view = await createPage(workspaceId, rootId, name);
    return NextResponse.json({ id: view.view_id }, { status: 201 });
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

  // AppFlowy doesn't have a status field on pages — acknowledge the call gracefully.
  return NextResponse.json(
    { ok: true, note: "Status updates are managed inside AppFlowy directly." }
  );
}
