import { NextResponse } from "next/server";
import { getBlogPostBySlug } from "@/lib/blog-source";
import { isAppFlowyConfigured } from "@/lib/appflowy";
import { isConfiguredAsync } from "@/lib/integrations";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const appFlowyConfigured = await isAppFlowyConfigured();
  const notionConfigured = await isConfiguredAsync("NOTION_API_KEY", "NOTION_BLOG_DB_ID");

  if (!appFlowyConfigured && !notionConfigured) {
    const { posts: blogPosts } = await import("@/lib/blog");
    const post = blogPosts.find((p: { slug: string }) => p.slug === slug);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    return NextResponse.json({ post, source: "static" });
  }

  try {
    const post = await getBlogPostBySlug(slug);
    if (!post) {
      const { posts } = await import("@/lib/blog");
      const staticPost = (posts as Array<{ slug: string }>).find((p) => p.slug === slug);
      if (!staticPost) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
      return NextResponse.json(
        { post: staticPost, source: "static" },
        { headers: { "x-blog-source": "static" } }
      );
    }
    // Prefer AppFlowy when configured and the slug resolved through the dual-run chain.
    // getBlogPostBySlug already tried AppFlowy first; if we got a post while AppFlowy is
    // configured, treat it as appflowy unless Notion was the only configured source.
    const source = appFlowyConfigured ? "appflowy" : "notion";
    return NextResponse.json(
      { post, source },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
          "x-blog-source": source,
        },
      }
    );
  } catch (err) {
    console.error("[Blog] Fetch post error:", err);
    const { posts } = await import("@/lib/blog");
    const staticPost = (posts as Array<{ slug: string }>).find((p) => p.slug === slug);
    if (!staticPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return NextResponse.json(
      { post: staticPost, source: "static" },
      { headers: { "x-blog-source": "static" } }
    );
  }
}
