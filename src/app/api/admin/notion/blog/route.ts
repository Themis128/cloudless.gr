/**
 * /api/admin/notion/blog — backed by Notion
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getPosts } from "@/lib/notion-blog";
import { isConfigured } from "@/lib/integrations";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  // Check configuration
  if (!isConfigured("NOTION_API_KEY", "NOTION_BLOG_DB_ID")) {
    return NextResponse.json({ error: "Notion Blog not configured" }, { status: 503 });
  }

  try {
    const posts = await getPosts();
    return NextResponse.json({ posts, count: posts.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[Notion Blog] Failed to fetch posts:", msg);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}
