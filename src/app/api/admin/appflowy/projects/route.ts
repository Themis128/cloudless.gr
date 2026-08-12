/**
 * /api/admin/appflowy/projects — backed by AppFlowy
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  listProjects,
  createProject,
  updateProjectStatus,
  updateProjectProgress,
} from "@/lib/appflowy-projects";
import { isAppFlowyConfigured } from "@/lib/appflowy";
import type { ProjectStatus, ProjectPriority, ProjectType } from "@/lib/appflowy-projects";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isAppFlowyConfigured())) {
    return NextResponse.json({ error: "AppFlowy Projects not configured" }, { status: 503 });
  }

  const status = request.nextUrl.searchParams.get("status") as ProjectStatus | null;
  const projects = await listProjects(status ?? undefined);
  return NextResponse.json({ projects, count: projects.length });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isAppFlowyConfigured())) {
    return NextResponse.json({ error: "AppFlowy Projects not configured" }, { status: 503 });
  }

  const body = (await request.json()) as {
    name: string;
    status?: ProjectStatus;
    priority?: ProjectPriority;
    type?: ProjectType;
    owner?: string;
    description?: string;
    [key: string]: unknown;
  };
  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (typeof body.name !== "string" || body.name.trim().length === 0 || body.name.length > 200) {
    return NextResponse.json(
      {
        error: "name must be a non-empty string no longer than 200 characters",
      },
      { status: 400 }
    );
  }

  const id = await createProject(body);
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

  const body = (await request.json()) as { pageId?: string; status?: string; progress?: number };
  const { pageId, status, progress } = body;

  if (!pageId) {
    return NextResponse.json({ error: "pageId is required" }, { status: 400 });
  }

  if (status) {
    const valid: ProjectStatus[] = ["Planning", "In Progress", "On Hold", "Completed", "Cancelled"];
    if (!valid.includes(status as ProjectStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${valid.join(", ")}` },
        { status: 400 }
      );
    }
    const ok = await updateProjectStatus(pageId, status as ProjectStatus);
    if (!ok)
      return NextResponse.json(
        { error: "Write operations not yet implemented for AppFlowy" },
        { status: 501 }
      );
  }

  if (typeof progress === "number" && progress >= 0 && progress <= 100) {
    const ok = await updateProjectProgress(pageId, progress);
    if (!ok)
      return NextResponse.json(
        { error: "Write operations not yet implemented for AppFlowy" },
        { status: 501 }
      );
  }

  return NextResponse.json({ ok: true });
}
