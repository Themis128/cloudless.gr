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
import { getBlogPostsWithSource } from "@/lib/blog-source";
import { isAppFlowyConfigured } from "@/lib/appflowy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

  const appFlowyConfigured = await isAppFlowyConfigured();

  if (!appFlowyConfigured) {
    const { posts: staticPosts } = await import("@/lib/blog");
    let posts = staticPosts;
    if (limit) {
      posts = posts.slice(0, limit);
    }
    return NextResponse.json(posts, { headers: { "x-blog-source": "static" } });
  }

  try {
    const result = await getBlogPostsWithSource();
    let posts = result.posts;
    if (limit) {
      posts = posts.slice(0, limit);
    }

    return NextResponse.json(posts, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        "x-blog-source": result.source,
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
