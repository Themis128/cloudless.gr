/**
 * /api/admin/appflowy/blog — backed by AppFlowy
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getPosts } from "@/lib/appflowy-blog";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const posts = await getPosts();
    return NextResponse.json({ posts, count: posts.length });
  } catch (err) {
    return NextResponse.json({ error: "Failed to list posts" }, { status: 500 });
  }
}
