/**
 * /api/admin/appflowy/status — backed by AppFlowy
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isAppFlowyConfigured, listAllWorkspaces } from "@/lib/appflowy";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const configured = await isAppFlowyConfigured();
    const workspaces = configured ? await listAllWorkspaces() : [];

    return NextResponse.json({
      configured,
      workspaces,
    });
  } catch (err) {
    return NextResponse.json({
      configured: false,
      workspaces: [],
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}