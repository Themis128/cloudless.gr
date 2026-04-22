import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  listTasks,
  createTask,
  updateTaskStatus,
  getTaskSummary,
} from "@/lib/notion-projects";
import type { TaskStatus } from "@/lib/notion-projects";
import { isConfiguredAsync } from "@/lib/integrations";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_TASKS_DB_ID"))) {
    return NextResponse.json(
      { error: "Notion Tasks not configured" },
      { status: 503 },
    );
  }

  const summary = request.nextUrl.searchParams.get("summary");
  if (summary === "true") {
    const counts = await getTaskSummary();
    return NextResponse.json({ summary: counts });
  }

  const status = request.nextUrl.searchParams.get(
    "status",
  ) as TaskStatus | null;
  const project = request.nextUrl.searchParams.get("project");
  const assignee = request.nextUrl.searchParams.get("assignee");

  const tasks = await listTasks({
    status: status ?? undefined,
    project: project ?? undefined,
    assignee: assignee ?? undefined,
  });

  return NextResponse.json({ tasks, count: tasks.length });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_TASKS_DB_ID"))) {
    return NextResponse.json(
      { error: "Notion Tasks not configured" },
      { status: 503 },
    );
  }

  const body = await request.json();
  if (!body.task) {
    return NextResponse.json({ error: "task is required" }, { status: 400 });
  }

  if (typeof body.task !== "string" || body.task.length > 500) {
    return NextResponse.json(
      { error: "task must be a string no longer than 500 characters" },
      { status: 400 },
    );
  }

  const id = await createTask(body);
  if (!id) {
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 },
    );
  }
  return NextResponse.json({ id }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { pageId, status } = body;

  if (!pageId || !status) {
    return NextResponse.json(
      { error: "pageId and status are required" },
      { status: 400 },
    );
  }

  const valid: TaskStatus[] = [
    "Backlog",
    "To Do",
    "In Progress",
    "In Review",
    "Done",
    "Blocked",
  ];
  if (!valid.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${valid.join(", ")}` },
      { status: 400 },
    );
  }

  const ok = await updateTaskStatus(pageId, status);
  if (!ok) {
    return NextResponse.json(
      { error: "Failed to update task status" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
