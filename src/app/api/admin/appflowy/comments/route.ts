import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isAppFlowyConfigured } from "@/lib/appflowy";
import { listComments, addComment } from "@/lib/appflowy-comments";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isAppFlowyConfigured())) {
    return NextResponse.json({ error: "AppFlowy Comments not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get("page_id");

  if (!pageId) {
    return NextResponse.json({ error: "page_id query parameter is required" }, { status: 400 });
  }

  try {
    const comments = await listComments(pageId);
    return NextResponse.json({ comments, count: comments.length });
  } catch (err) {
    console.error("[Admin AppFlowy Comments] GET failed:", err);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isAppFlowyConfigured())) {
    return NextResponse.json({ error: "AppFlowy Comments not configured" }, { status: 503 });
  }

  const body = (await request.json()) as { pageId?: unknown; text?: unknown };
  const pageId = typeof body.pageId === "string" ? body.pageId : "";
  const text = typeof body.text === "string" ? body.text : "";
  if (!pageId || !text) {
    return NextResponse.json({ error: "pageId and text are required" }, { status: 400 });
  }

  const ok = await addComment(pageId, text);
  if (!ok) return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  return NextResponse.json({ success: true });
}