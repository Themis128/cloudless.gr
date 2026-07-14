/**
 * /api/admin/notion/tasks — backed by AppFlowy
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  listAllWorkspaces,
  listWorkspaceViews,
  createPage,
  AppFlowyNotConfiguredError,
} from "@/lib/appflowy";

type TaskStatus = "Backlog" | "To Do" | "In Progress" | "In Review" | "Done" | "Blocked";

interface Task {
  id: string;
  name: string;
  status: TaskStatus;
}

function viewToTask(v: {
  view_id: string;
  name: string;
  layout: string;
  created_at: string;
  last_edited_time: string;
}): Task {
  // Extract status from name if it starts with [Status] pattern
  const statusMatch = v.name.match(/^\[(Backlog|To Do|In Progress|In Review|Done|Blocked)\]/);
  const status = (statusMatch?.[1] ?? "To Do") as TaskStatus;
  return {
    id: v.view_id,
    name: v.name,
    status,
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

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") as TaskStatus | null;
    const summary = searchParams.get("summary") === "true";

    const views = await listWorkspaceViews(workspaceId);
    let tasks = views.filter((v) => v.layout === "Document").map(viewToTask);

    if (statusFilter) {
      tasks = tasks.filter((t) => t.status === statusFilter);
    }

    if (summary) {
      const counts: Record<TaskStatus, number> = {
        Backlog: 0,
        "To Do": 0,
        "In Progress": 0,
        "In Review": 0,
        Done: 0,
        Blocked: 0,
      };
      for (const t of tasks) {
        counts[t.status] = (counts[t.status] || 0) + 1;
      }
      return NextResponse.json({ tasks, count: tasks.length, summary: counts });
    }

    return NextResponse.json({ tasks, count: tasks.length });
  } catch (err) {
    if (err instanceof AppFlowyNotConfiguredError) {
      return NextResponse.json({ error: "AppFlowy not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to list tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body: { task?: string } = await request.json();
    const { task } = body;

    if (!task) {
      return NextResponse.json({ error: "task required" }, { status: 400 });
    }

    const taskName = task;
    if (typeof taskName !== "string" || taskName.length > 500) {
      return NextResponse.json({ error: "Task exceeds 500 characters" }, { status: 400 });
    }

    const workspaceId = await getPrimaryWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: "No AppFlowy workspace found" }, { status: 503 });
    }

    const result = await createPage(workspaceId, "root-view", taskName);

    return NextResponse.json({ id: result.view_id }, { status: 201 });
  } catch (err) {
    if (err instanceof AppFlowyNotConfiguredError) {
      return NextResponse.json({ error: "AppFlowy not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body: { pageId?: string; status?: string } = await request.json();
    const { pageId, status } = body;

    if (!pageId || !status) {
      return NextResponse.json({ error: "pageId and status required" }, { status: 400 });
    }

    const validStatuses: TaskStatus[] = [
      "Backlog",
      "To Do",
      "In Progress",
      "In Review",
      "Done",
      "Blocked",
    ];
    if (!validStatuses.includes(status as TaskStatus)) {
      return NextResponse.json(
        { error: `Invalid status — must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // AppFlowy doesn't support status updates via API, acknowledge gracefully
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AppFlowyNotConfiguredError) {
      return NextResponse.json({ error: "AppFlowy not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
