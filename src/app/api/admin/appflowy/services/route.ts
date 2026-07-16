/**
 * /api/admin/appflowy/services — backed by AppFlowy
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listAllWorkspaces, listWorkspaceViews, AppFlowyNotConfiguredError } from "@/lib/appflowy";

interface ServiceItem {
  id: string;
  name: string;
  description: string;
  url: string;
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
    const services: ServiceItem[] = views.map((v) => ({
      id: v.view_id,
      name: v.name,
      description: "",
      url: `/appflowy/view/${v.view_id}`,
    }));

    return NextResponse.json({ services, count: services.length });
  } catch (err) {
    if (err instanceof AppFlowyNotConfiguredError) {
      return NextResponse.json({ error: "AppFlowy not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to list services" }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  return NextResponse.json({ error: "Create via AppFlowy UI" }, { status: 501 });
}

export async function PATCH(_request: NextRequest) {
  return NextResponse.json({ ok: true, note: "Updates are managed inside AppFlowy directly." });
}

export async function DELETE(_request: NextRequest) {
  return NextResponse.json({ ok: false, error: "Delete via AppFlowy UI" }, { status: 501 });
}