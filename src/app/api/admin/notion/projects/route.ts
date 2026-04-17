import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  listProjects,
  createProject,
  updateProjectStatus,
  updateProjectProgress,
} from "@/lib/notion-projects";
import type { ProjectStatus } from "@/lib/notion-projects";
import { isConfigured } from "@/lib/integrations";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!isConfigured("NOTION_API_KEY", "NOTION_PROJECTS_DB_ID")) {
    return NextResponse.json(
      { error: "Notion Projects not configured" },
      { status: 503 },
    );
  }

  const status = request.nextUrl.searchParams.get(
    "status",
  ) as ProjectStatus | null;
  const projects = await listProjects(status ?? undefined);
  return NextResponse.json({ projects, count: projects.length });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!isConfigured("NOTION_API_KEY", "NOTION_PROJECTS_DB_ID")) {
    return NextResponse.json(
      { error: "Notion Projects not configured" },
      { status: 503 },
    );
  }

  const body = await request.json();
  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (
    typeof body.name !== "string" ||
    body.name.trim().length === 0 ||
    body.name.length > 200
  ) {
    return NextResponse.json(
      {
        error: "name must be a non-empty string no longer than 200 characters",
      },
      { status: 400 },
    );
  }

  const id = await createProject(body);
  if (!id) {
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
  return NextResponse.json({ id }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { pageId, status, progress } = body;

  if (!pageId) {
    return NextResponse.json({ error: "pageId is required" }, { status: 400 });
  }

  if (status) {
    const valid: ProjectStatus[] = [
      "Planning",
      "In Progress",
      "On Hold",
      "Completed",
      "Cancelled",
    ];
    if (!valid.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${valid.join(", ")}` },
        { status: 400 },
      );
    }
    const ok = await updateProjectStatus(pageId, status);
    if (!ok)
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  if (typeof progress === "number" && progress >= 0 && progress <= 100) {
    const ok = await updateProjectProgress(pageId, progress);
    if (!ok)
      return NextResponse.json(
        { error: "Failed to update progress" },
        { status: 500 },
      );
  }

  return NextResponse.json({ ok: true });
}
