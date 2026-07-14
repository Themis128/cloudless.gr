/**
 * /api/admin/appflowy/tasks — backed by AppFlowy (self-hosted Notion replacement).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listAllWorkspaces, listWorkspaceViews, AppFlowyNotConfiguredError } from "@/lib/appflowy";

type TaskStatus = "To Do" | "In Progress" | "Done" | "Cancelled";

interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  priority: string;
  project: string;
  assignee: string;
  dueDate: string;
  description: string;
  url: string;
}

function viewToTask(v: {
  view_id: string;
  name: string;
  layout: string;
  created_at: string;
  last_edited_time: string;
}): Task {
  return {
    id: v.view_id,
    name: v.name,
    status: "To Do" as TaskStatus,
    priority: "Medium",
    project: "",
    assignee: "",
    dueDate: v.created_at,
    description: "",
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

    const views = await listWorkspaceViews(workspaceId);
    // Tasks are typically linked to projects, but AppFlowy views are flat
    // Return all document views as tasks
    const tasks = views.filter((v) => v.layout === "Document").map(viewToTask);

    return NextResponse.json({ tasks, count: tasks.length });
  } catch (err) {
    if (err instanceof AppFlowyNotConfiguredError) {
      return NextResponse.json({ error: "AppFlowy not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to list tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: "Create via AppFlowy UI" }, { status: 501 });
}

export async function PATCH(request: NextRequest) {
  return NextResponse.json({
    ok: true,
    note: "Status updates are managed inside AppFlowy directly.",
  });
}
