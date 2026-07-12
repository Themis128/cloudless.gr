/**
 * /api/admin/appflowy/case-studies — backed by AppFlowy
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  listAllWorkspaces,
  listWorkspaceViews,
  AppFlowyNotConfiguredError,
} from "@/lib/appflowy";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const workspaceId = (await listAllWorkspaces())[0]?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ caseStudies: [], count: 0 });
    }

    const views = await listWorkspaceViews(workspaceId);
    const caseStudies = views.map((v) => ({
      id: v.view_id,
      title: v.name,
      url: `/appflowy/view/${v.view_id}`,
    }));

    return NextResponse.json({ caseStudies, count: caseStudies.length });
  } catch (err) {
    if (err instanceof AppFlowyNotConfiguredError) {
      return NextResponse.json({ caseStudies: [], count: 0 });
    }
    return NextResponse.json({ error: "Failed to list case studies" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: "Create via AppFlowy UI" }, { status: 501 });
}

export async function PATCH() {
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  return NextResponse.json({ error: "Delete via AppFlowy UI" }, { status: 501 });
}