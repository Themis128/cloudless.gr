import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createCalendarItem, type CalendarItem } from "@/lib/content-calendar";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let input: Omit<CalendarItem, "id">;
  try {
    input = await request.json();
    if (!input.title || !input.type || !input.platform || !input.date) {
      throw new Error("title, type, platform, date are required");
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid input" },
      { status: 400 },
    );
  }

  const item = await createCalendarItem(input);
  return NextResponse.json({ item }, { status: 201 });
}
