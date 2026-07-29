import { NextResponse } from "next/server";
import { getBlogPosts } from "@/lib/blog-source";
import { isConfiguredAsync } from "@/lib/integrations";

export async function GET() {
  const appFlowyConfigured = await isConfiguredAsync("APPFLOWY_API_URL", "APPFLOWY_JWT_SECRET");
  const notionConfigured = await isConfiguredAsync("NOTION_API_KEY", "NOTION_BLOG_DB_ID");

  if (!appFlowyConfigured && !notionConfigured) {
    const { posts: blogPosts } = await import("@/lib/blog");
    return NextResponse.json(
      { posts: blogPosts, source: "static", fallbackReason: "not-configured" },
      { headers: { "x-blog-source": "static" } }
    );
  }

  try {
    const posts = await getBlogPosts();
    if (!posts || posts.length === 0) {
      const { posts: blogPosts } = await import("@/lib/blog");
      return NextResponse.json(
        { posts: blogPosts, source: "static", fallbackReason: "cms-empty" },
        { headers: { "x-blog-source": "static" } }
      );
    }
    const source = appFlowyConfigured ? "appflowy" : "notion";
    return NextResponse.json(
      { posts, source },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
          "x-blog-source": source,
        },
      }
    );
  } catch (err) {
    console.error("[Blog] Fetch error:", err);
    const { posts: blogPosts } = await import("@/lib/blog");
    return NextResponse.json(
      { posts: blogPosts, source: "static", fallbackReason: "cms-error" },
      { headers: { "x-blog-source": "static" } }
    );
  }
}
