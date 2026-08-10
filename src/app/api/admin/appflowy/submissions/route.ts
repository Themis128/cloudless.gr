import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listSubmissions, updateSubmissionStatus } from "@/lib/appflowy-forms";
import { isAppFlowyConfigured } from "@/lib/appflowy";
import { mapIntegrationError } from "@/lib/api-errors";

/**
 * GET /api/admin/appflowy/submissions
 *
 * Returns recent contact form submissions stored in AppFlowy.
 * Query params:
 *   limit  — number of results (default 50, max 100)
 *
 * PATCH /api/admin/appflowy/submissions
 *
 * Updates the status of a single submission.
 * Body: { pageId: string, status: "New" | "In Review" | "Done" }
 */

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isAppFlowyConfigured())) {
    return NextResponse.json({ error: "AppFlowy submissions not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

  try {
    const submissions = await listSubmissions(limit);
    return NextResponse.json({ submissions, count: submissions.length });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[Admin] Failed to list submissions:", err);
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isAppFlowyConfigured())) {
    return NextResponse.json({ error: "AppFlowy not configured" }, { status: 503 });
  }

  let body: { pageId?: string; status?: string };
  try {
    body = await request.json();
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pageId, status } = body;

  if (!pageId || !status) {
    return NextResponse.json({ error: "pageId and status are required" }, { status: 400 });
  }

  const validStatuses = ["New", "In Review", "Done"] as const;
  if (!validStatuses.includes(status as (typeof validStatuses)[number])) {
    return NextResponse.json(
      { error: `status must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const ok = await updateSubmissionStatus(pageId, status as "New" | "In Review" | "Done");
    if (!ok) {
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[Admin] Failed to update submission status:", err);
    return NextResponse.json({ error: "Failed to update submission status" }, { status: 500 });
  }
}
