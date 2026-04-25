import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getPosts } from "@/lib/notion-blog";
import { isConfiguredAsync } from "@/lib/integrations";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_BLOG_DB_ID"))) {
    return NextResponse.json(
      { error: "Notion Blog not configured" },
      { status: 503 },
    );
  }

  const posts = await getPosts();
  return NextResponse.json({ posts, count: posts.length });
}
