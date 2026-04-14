import { NextResponse } from "next/server";
import { getPostBySlug } from "@/lib/notion-blog";
import { isConfigured } from "@/lib/integrations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (!isConfigured("NOTION_API_KEY", "NOTION_BLOG_DB_ID")) {
    const blogModule = await import("@/lib/blog");
    const blogPosts = blogModule.posts;
    const post = blogPosts.find((p: { slug: string }) => p.slug === slug);
    if (!post)
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    return NextResponse.json({ post, source: "static" });
  }

  try {
    const post = await getPostBySlug(slug);
    if (!post) {
      // Notion returned null — fall back to static
      const blogModule = await import("@/lib/blog");
      const staticPost = (blogModule.posts as Array<{ slug: string }>).find((p) => p.slug === slug);
      if (!staticPost) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
      return NextResponse.json(
        { post: staticPost, source: "static" },
        { headers: { "x-blog-source": "static" } },
      );
    }
    return NextResponse.json(
      { post, source: "notion" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
          "x-blog-source": "notion",
        },
      },
    );
  } catch (err) {
    console.error("[Blog] Fetch post error:", err);
    // Notion threw — fall back to static
    const blogModule = await import("@/lib/blog");
    const staticPost = (blogModule.posts as Array<{ slug: string }>).find((p) => p.slug === slug);
    if (!staticPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return NextResponse.json(
      { post: staticPost, source: "static" },
      { headers: { "x-blog-source": "static" } },
    );
  }
}
