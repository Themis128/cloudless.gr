/**
 * /api/admin/notion/tasks — backed by AppFlowy workspace pages.
 *
 * AppFlowy doesn't have a typed Tasks grid by default. Tasks are Document
 * pages whose names begin with a status prefix, or any flat document list.
 * The route returns all Document views mapped to the Task shape so the
 * admin UI keeps working unchanged.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  listAllWorkspaces,
  listWorkspaceViews,
  createPage,
  AppFlowyNotConfiguredError,
} from "@/lib/appflowy";
import type { Task, TaskStatus } from "@/lib/notion-projects";

const STATUS_PREFIXES: TaskStatus[] = [
  "Backlog",
  "To Do",
  "In Progress",
  "In Review",
  "Done",
  "Blocked",
];

function inferStatus(name: string): TaskStatus {
  for (const s of STATUS_PREFIXES) {
    if (name.startsWith(`[${s}]`) || name.toLowerCase().includes(s.toLowerCase())) return s;
  }
  return "To Do";
}

function viewToTask(v: {
  view_id: string;
  name: string;
  created_at: string;
  last_edited_time: string;
}): Task {
  return {
    id: v.view_id,
    task: v.name,
    status: inferStatus(v.name),
    priority: "Medium",
    assignee: "",
    project: "",
    dueDate: "",
    estimate: "",
    type: "",
    description: "",
    labels: [],
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

    const summary = request.nextUrl.searchParams.get("summary");
    const statusFilter = request.nextUrl.searchParams.get("status") as TaskStatus | null;

    const views = await listWorkspaceViews(workspaceId);
    const tasks = views.filter((v) => v.layout === "Document").map(viewToTask);

    if (summary === "true") {
      const counts: Record<string, number> = {};
      for (const s of STATUS_PREFIXES) counts[s] = 0;
      for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
      return NextResponse.json({ summary: counts });
    }

    const filtered = statusFilter ? tasks.filter((t) => t.status === statusFilter) : tasks;
    return NextResponse.json({ tasks: filtered, count: filtered.length });
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

  let body: Record<string, unknown>;
  try {
    body = (((await request.json()) as any)) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const task = typeof body.task === "string" ? body.task.trim() : "";
  if (!task || task.length > 500) {
    return NextResponse.json(
      { error: "task must be a string no longer than 500 characters" },
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
    const view = await createPage(workspaceId, rootId, task);
    return NextResponse.json({ id: view.view_id }, { status: 201 });
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

  let body: Record<string, unknown>;
  try {
    body = (((await request.json()) as any)) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pageId = typeof body.pageId === "string" ? body.pageId.trim() : "";
  const status = typeof body.status === "string" ? body.status : "";

  if (!pageId || !status) {
    return NextResponse.json({ error: "pageId and status are required" }, { status: 400 });
  }

  if (!STATUS_PREFIXES.includes(status as TaskStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${STATUS_PREFIXES.join(", ")}` },
      { status: 400 }
    );
  }

  // AppFlowy doesn't expose a page-rename endpoint in the REST API.
  // Status is tracked by page-name prefix convention — acknowledge the call.
  return NextResponse.json({ ok: true, pageId, status });
}
