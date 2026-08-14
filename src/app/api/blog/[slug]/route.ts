import { NextResponse } from "next/server";
import { getBlogPostBySlug } from "@/lib/blog-source";
import { isAppFlowyConfigured } from "@/lib/appflowy";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!(await isAppFlowyConfigured())) {
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
    return NextResponse.json(
      { post, source: "appflowy" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
          "x-blog-source": "appflowy",
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
