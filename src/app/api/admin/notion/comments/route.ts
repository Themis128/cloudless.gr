import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listComments, addComment } from "@/lib/notion-comments";

/**
 * GET /api/admin/notion/comments?page_id=...
 * POST /api/admin/notion/comments { page_id, text }
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get("page_id");

  if (!pageId) {
    return NextResponse.json({ error: "page_id is required" }, { status: 400 });
  }

  try {
    const comments = await listComments(pageId);
    return NextResponse.json({ comments });
  } catch (err) {
    console.error("[API] Comments error:", err);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const authPost = await requireAdmin(request);
  if (!authPost.ok) return authPost.response;

  try {
    const { page_id, text } = await request.json();

    if (!page_id || !text) {
      return NextResponse.json(
        { error: "page_id and text are required" },
        { status: 400 },
      );
    }

    if (typeof text !== "string" || text.length > 5000) {
      return NextResponse.json(
        { error: "text must be a string no longer than 5000 characters" },
        { status: 400 },
      );
    }

    const comment = await addComment(page_id, text);
    if (!comment) {
      return NextResponse.json(
        { error: "Failed to add comment" },
        { status: 500 },
      );
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    console.error("[API] Add comment error:", err);
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 },
    );
  }
}
