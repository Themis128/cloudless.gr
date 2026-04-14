import { NextResponse } from "next/server";
import { getPosts } from "@/lib/notion-blog";
import { isConfigured } from "@/lib/integrations";

export async function GET() {
  if (!isConfigured("NOTION_API_KEY", "NOTION_BLOG_DB_ID")) {
    // Fall back to static blog data when Notion is not configured
    const blogModule = await import("@/lib/blog");
    const blogPosts = blogModule.posts;
    return NextResponse.json({ posts: blogPosts, source: "static" });
  }

  try {
    const posts = await getPosts();
    return NextResponse.json(
      { posts, source: "notion" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        },
      },
    );
  } catch (err) {
    console.error("[Blog] Fetch error:", err);
    const blogModule = await import("@/lib/blog");
    const blogPosts = blogModule.posts;
    return NextResponse.json({ posts: blogPosts, source: "static" });
  }
}
