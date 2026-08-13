/**
 * /api/admin/appflowy/tasks — backed by AppFlowy
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  listTasks,
  createTask,
  updateTaskStatus,
  type TaskStatus,
  type TaskPriority,
  type TaskType,
} from "@/lib/appflowy-projects";
import { isAppFlowyConfigured } from "@/lib/appflowy";

const VALID_STATUS: TaskStatus[] = [
  "Backlog",
  "To Do",
  "In Progress",
  "In Review",
  "Done",
  "Blocked",
];

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isAppFlowyConfigured())) {
    return NextResponse.json({ error: "AppFlowy Tasks not configured" }, { status: 503 });
  }

  const status = request.nextUrl.searchParams.get("status") as TaskStatus | null;
  const project = request.nextUrl.searchParams.get("project");
  const assignee = request.nextUrl.searchParams.get("assignee");

  const tasks = await listTasks({
    status: status && VALID_STATUS.includes(status) ? status : undefined,
    project: project || undefined,
    assignee: assignee || undefined,
  });
  return NextResponse.json({ tasks, count: tasks.length });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isAppFlowyConfigured())) {
    return NextResponse.json({ error: "AppFlowy Tasks not configured" }, { status: 503 });
  }

  const body = (await request.json()) as {
    task?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    project?: string;
    assignee?: string;
    type?: TaskType;
    description?: string;
    dueDate?: string;
  };

  if (!body.task || typeof body.task !== "string" || !body.task.trim() || body.task.length > 200) {
    return NextResponse.json(
      { error: "task must be a non-empty string no longer than 200 characters" },
      { status: 400 }
    );
  }

  const id = await createTask({
    task: body.task.trim(),
    status: body.status,
    priority: body.priority,
    project: body.project,
    assignee: body.assignee,
    type: body.type,
    description: body.description,
    dueDate: body.dueDate,
  });
  if (!id) {
    return NextResponse.json(
      { error: "Write operations not yet implemented for AppFlowy" },
      { status: 501 }
    );
  }
  return NextResponse.json({ id }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isAppFlowyConfigured())) {
    return NextResponse.json({ error: "AppFlowy Tasks not configured" }, { status: 503 });
  }

  const body = (await request.json()) as { pageId?: string; status?: string };
  const { pageId, status } = body;

  if (!pageId) {
    return NextResponse.json({ error: "pageId is required" }, { status: 400 });
  }

  if (!status || !VALID_STATUS.includes(status as TaskStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUS.join(", ")}` },
      { status: 400 }
    );
  }

  const ok = await updateTaskStatus(pageId, status as TaskStatus);
  if (!ok) {
    return NextResponse.json(
      { error: "Write operations not yet implemented for AppFlowy" },
      { status: 501 }
    );
  }
  return NextResponse.json({ ok: true });
}
