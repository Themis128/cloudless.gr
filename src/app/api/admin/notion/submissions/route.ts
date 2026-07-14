/**
 * /api/admin/notion/submissions — backed by Notion (for admin management)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listSubmissions, updateSubmissionStatus } from "@/lib/notion-forms";
import { isConfigured } from "@/lib/integrations";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  // Check configuration upfront to return 503 for missing integrations
  if (!isConfigured("NOTION_API_KEY", "NOTION_SUBMISSIONS_DB_ID")) {
    return NextResponse.json({ error: "Notion not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

  try {
    const submissions = await listSubmissions(limit);
    return NextResponse.json({ submissions, count: submissions.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[Notion Submissions] Failed to list submissions:", msg);
    return NextResponse.json({ error: "Failed to list submissions" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  // Check configuration upfront to return 503 for missing integrations
  if (!isConfigured("NOTION_API_KEY")) {
    return NextResponse.json({ error: "Notion not configured" }, { status: 503 });
  }

  try {
    const body: { pageId?: string; status?: string } = await request.json();
    const { pageId, status } = body;

    if (!pageId || !status) {
      return NextResponse.json({ error: "pageId and status required" }, { status: 400 });
    }

    const validStatuses = ["New", "In Review", "Done"] as const;
    if (!validStatuses.includes(status as (typeof validStatuses)[number])) {
      return NextResponse.json(
        { error: `Invalid status — must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const success = await updateSubmissionStatus(pageId, status as "New" | "In Review" | "Done");

    if (!success) {
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[Notion Submissions] Failed to update status:", msg);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
