/**
 * /api/admin/notion/comments — backed by Notion
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listComments, addComment } from "@/lib/notion-comments";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get("page_id");

  if (!pageId) {
    return NextResponse.json({ error: "page_id required" }, { status: 400 });
  }

  try {
    const comments = await listComments(pageId);
    return NextResponse.json({ comments });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[Notion Comments] Failed to list comments:", msg);
    return NextResponse.json({ error: "Failed to list comments" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body: { page_id?: string; text?: string } = await request.json();

    if (!body.page_id || !body.text) {
      return NextResponse.json({ error: "page_id and text required" }, { status: 400 });
    }

    const { page_id, text } = body;
    if (text.length > 5000) {
      return NextResponse.json({ error: "Text exceeds 5000 characters" }, { status: 400 });
    }

    const result = await addComment(page_id, text);

    if (!result) {
      return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
    }

    return NextResponse.json({ comment: { id: result.id, text: result.text } }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[Notion Comments] Failed to add comment:", msg);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}