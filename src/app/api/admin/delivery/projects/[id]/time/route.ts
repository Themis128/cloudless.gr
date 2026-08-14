import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createTimeEntry, listTimeEntries, type TimeEntry } from "@/lib/agency-projects-d1";

export type { TimeEntry };

const AP_RE = /^ap_[a-zA-Z0-9-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!AP_RE.test(id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? "100") || 100, 200);
    const { bound, entries } = await listTimeEntries(id, limit);
    if (!bound) {
      return NextResponse.json({ error: "AUTH_DB not configured" }, { status: 503 });
    }
    return NextResponse.json({ entries, total: entries.length, projectId: id });
  } catch (e) {
    console.error("[delivery] list time failed:", e);
    return NextResponse.json({ error: "Failed to list time entries" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!AP_RE.test(id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const workDate = typeof body.workDate === "string" ? body.workDate.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
  const billable = body.billable === false ? false : true;

  let minutes = typeof body.minutes === "number" ? Math.round(body.minutes) : NaN;
  if (!Number.isFinite(minutes) && typeof body.hours === "number") {
    minutes = Math.round(body.hours * 60);
  }

  if (!DATE_RE.test(workDate) || !Number.isFinite(minutes) || minutes < 1) {
    return NextResponse.json(
      { error: "workDate (YYYY-MM-DD) and positive minutes/hours required" },
      { status: 400 }
    );
  }

  try {
    const entry = await createTimeEntry({
      projectId: id,
      workDate,
      minutes,
      description: description || null,
      billable,
      userId: auth.user.sub,
    });
    if (!entry) {
      return NextResponse.json(
        { error: "Failed to log time (project missing or AUTH_DB unbound)" },
        { status: 503 }
      );
    }
    return NextResponse.json({ entry }, { status: 201 });
  } catch (e) {
    console.error("[delivery] log time failed:", e);
    return NextResponse.json({ error: "Failed to log time" }, { status: 500 });
  }
}
