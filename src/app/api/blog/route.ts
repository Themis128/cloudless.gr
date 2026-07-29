/**
 * GET /api/blog — Returns all blog posts.
 *
 * This endpoint aggregates from /api/blog/posts and provides a simple
 * all-posts view for the marketing site.
 *
 * Query params:
 *   - limit: Max posts to return (default: all)
 */
import { NextResponse } from "next/server";
import { getBlogPosts } from "@/lib/blog-source";
import { isConfiguredAsync } from "@/lib/integrations";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

  const appFlowyConfigured = await isConfiguredAsync("APPFLOWY_API_URL", "APPFLOWY_JWT_SECRET");
  const notionConfigured = await isConfiguredAsync("NOTION_API_KEY", "NOTION_BLOG_DB_ID");

  if (!appFlowyConfigured && !notionConfigured) {
    const { posts: staticPosts } = await import("@/lib/blog");
    let posts = staticPosts;
    if (limit) {
      posts = posts.slice(0, limit);
    }
    return NextResponse.json(posts, { headers: { "x-blog-source": "static" } });
  }

  try {
    let posts = await getBlogPosts();
    if (limit) {
      posts = posts.slice(0, limit);
    }
    const source = appFlowyConfigured ? "appflowy" : "notion";

    return NextResponse.json(posts, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        "x-blog-source": source,
      },
    });
  } catch (err) {
    console.error("[Blog API] Fetch error:", err);
    const { posts: staticPosts } = await import("@/lib/blog");
    let posts = staticPosts;
    if (limit) {
      posts = posts.slice(0, limit);
    }
    return NextResponse.json(posts, { headers: { "x-blog-source": "static" } });
  }
}
