import { NextResponse } from "next/server";
import { getPosts } from "@/lib/notion-blog";
import { isConfigured } from "@/lib/integrations";

const BLOG_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=30";

async function getStaticPosts() {
  const blogModule = await import("@/lib/blog");
  return blogModule.posts;
}

async function staticPostsResponse(
  reason: "not-configured" | "notion-error",
) {
  const posts = await getStaticPosts();
  return NextResponse.json(
    {
      posts,
      source: "static",
      fallbackReason: reason,
    },
    {
      headers: {
        "Cache-Control": BLOG_CACHE_CONTROL,
        "X-Blog-Source": "static",
      },
    },
  );
}

export async function GET() {
  if (!isConfigured("NOTION_API_KEY", "NOTION_BLOG_DB_ID")) {
    // Fall back to static blog data when Notion is not configured.
    return staticPostsResponse("not-configured");
  }

  try {
    const posts = await getPosts();
    return NextResponse.json(
      { posts, source: "notion" },
      {
        headers: {
          "Cache-Control": BLOG_CACHE_CONTROL,
          "X-Blog-Source": "notion",
        },
      },
    );
  } catch (err) {
    console.error("[Blog] Fetch error:", err);
    return staticPostsResponse("notion-error");
  }
}
