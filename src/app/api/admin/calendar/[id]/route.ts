import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { updateCalendarItem, deleteCalendarItem, type CalendarItem } from "@/lib/content-calendar";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const updates = (await request.json()) as Partial<Omit<CalendarItem, "id">>;
  let item;
  try {
    item = await updateCalendarItem(id, updates);
  } catch (e) {
    console.error("[calendar/[id]] PATCH failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update calendar item" },
      { status: 502 }
    );
  }
  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }
  return NextResponse.json({ item });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const deleted = await deleteCalendarItem(id);
  if (!deleted) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
