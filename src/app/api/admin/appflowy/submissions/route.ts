/**
 * /api/admin/appflowy/submissions — backed by AppFlowy
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  listAllWorkspaces,
  listWorkspaceViews,
  AppFlowyNotConfiguredError,
} from "@/lib/appflowy";

interface Submission {
  id: string;
  name: string;
  email: string;
  company: string;
  service: string;
  message: string;
  status: string;
  source: string;
  submittedAt: string;
  url: string;
}

async function getPrimaryWorkspaceId(): Promise<string | null> {
  const workspaces = await listAllWorkspaces();
  return workspaces[0]?.workspace_id ?? null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 100);

  try {
    const workspaceId = await getPrimaryWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: "No AppFlowy workspace found" }, { status: 503 });
    }

    const views = await listWorkspaceViews(workspaceId);
    // Filter for submission-like documents (would need specific naming convention in AppFlowy)
    const submissions: Submission[] = views.slice(0, limit).map((v) => ({
      id: v.view_id,
      name: v.name,
      email: "",
      company: "",
      service: "",
      message: "",
      status: "New",
      source: "contact",
      submittedAt: v.last_edited_time,
      url: `/appflowy/view/${v.view_id}`,
    }));

    return NextResponse.json({ submissions, count: submissions.length });
  } catch (err) {
    if (err instanceof AppFlowyNotConfiguredError) {
      return NextResponse.json({ error: "AppFlowy not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to list submissions" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  // AppFlowy doesn't have structured submission metadata - acknowledge gracefully
  return NextResponse.json({
    ok: true,
    note: "Status updates are managed inside AppFlowy directly.",
  });
}