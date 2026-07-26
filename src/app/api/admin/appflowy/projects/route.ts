/**
 * /api/admin/appflowy/projects — backed by AppFlowy (self-hosted Notion replacement).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listAllWorkspaces, listWorkspaceViews, AppFlowyNotConfiguredError } from "@/lib/appflowy";
export type { AppFlowyView } from "@/lib/appflowy";

type ProjectStatus = "Planning" | "In Progress" | "On Hold" | "Completed" | "Cancelled";

interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  priority: string;
  type: string;
  owner: string;
  startDate: string;
  dueDate: string;
  description: string;
  budget: number | null;
  progress: number;
  tags: string[];
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
      return NextResponse.json({ error: "No AppFlowy workspace found" }, { status: 404 });
    }

    const statusFilter = request.nextUrl.searchParams.get("status") as ProjectStatus | null;
    const views = await listWorkspaceViews(workspaceId);
    const projects = views.filter((v) => v.layout === "Document").map(viewToProject);
    const filtered = statusFilter ? projects.filter((p) => p.status === statusFilter) : projects;

    return NextResponse.json({ projects: filtered, count: filtered.length });
  } catch (err) {
    if (err instanceof AppFlowyNotConfiguredError) {
      return NextResponse.json({ error: "AppFlowy not configured" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to list projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as any;
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

  return NextResponse.json({ error: "Create via AppFlowy UI" }, { status: 501 });
}

export async function PATCH(_request: NextRequest) {
  // AppFlowy doesn't have a status field on pages — acknowledge the call gracefully.
  return NextResponse.json({
    ok: true,
    note: "Status updates are managed inside AppFlowy directly.",
  });
}
