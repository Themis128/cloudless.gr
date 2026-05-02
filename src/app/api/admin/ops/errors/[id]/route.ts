import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  isSentryConfigured,
  updateIssueStatus,
  type IssueStatus,
} from "@/lib/sentry";

type Params = { params: Promise<{ id: string }> };

/**
 * PUT /api/admin/ops/errors/[id]
 *
 * Update the status of a single Sentry issue.
 * Body: { status: "resolved" | "ignored" | "unresolved" }
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isSentryConfigured())) {
    return NextResponse.json(
      { error: "Sentry not configured." },
      { status: 503 },
    );
  }

  const { id } = await params;

  let status: IssueStatus;
  try {
    const body = await request.json();
    status = body.status;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validStatuses: IssueStatus[] = ["resolved", "ignored", "unresolved"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      {
        error: `Invalid status "${status}". Must be one of: ${validStatuses.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const ok = await updateIssueStatus(id, status);

  if (!ok) {
    return NextResponse.json(
      { error: "Failed to update issue status in Sentry." },
      { status: 502 },
    );
  }

  return NextResponse.json({ id, status });
}
