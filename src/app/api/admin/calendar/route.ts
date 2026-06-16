import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getCalendarItems } from "@/lib/content-calendar";
import { getActiveWorkspaceId } from "@/lib/workspace-server";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  // Filter by active workspace cookie if set. Items without a workspaceId
  // are org-wide and remain visible regardless — see content-calendar.ts.
  const workspaceId = await getActiveWorkspaceId(request);
  const items = await getCalendarItems(from, to, { workspaceId });
  return NextResponse.json({ items, total: items.length, workspaceId });
}
