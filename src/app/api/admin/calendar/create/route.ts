import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createCalendarItem, type CalendarItem } from "@/lib/content-calendar";
import { getActiveWorkspaceId } from "@/lib/workspace-server";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let input: Omit<CalendarItem, "id">;
  try {
    input = (await request.json()) as any;
    if (!input.title || !input.type || !input.platform || !input.date) {
      throw new Error("title, type, platform, date are required");
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid input" },
      { status: 400 }
    );
  }

  // Stamp the active workspace on new items so future filtered queries see
  // them. Body-provided workspaceId takes precedence (admin tooling can pin
  // a row to a specific tenant); otherwise the cookie wins. Falls through to
  // org-wide if neither is present.
  const cookieWorkspaceId = await getActiveWorkspaceId(request);
  const enriched: Omit<CalendarItem, "id"> = {
    ...input,
    workspaceId: input.workspaceId ?? cookieWorkspaceId ?? undefined,
  };

  let item;
  try {
    item = await createCalendarItem(enriched);
  } catch (e) {
    console.error("[calendar/create] failed to persist calendar item:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save calendar item" },
      { status: 502 }
    );
  }
  return NextResponse.json({ item }, { status: 201 });
}
