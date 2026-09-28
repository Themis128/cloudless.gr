import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/appflowy-blog", () => ({
  getPosts: vi.fn().mockResolvedValue([]),
  getPostBySlug: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/blog-r2", () => ({
  getR2BlogPosts: vi.fn().mockResolvedValue([]),
  getR2BlogPostBySlug: vi.fn().mockResolvedValue(null),
}));

import { getBlogPostsWithSource, getBlogPosts, getBlogPostBySlug } from "@/lib/blog-source";

describe("getBlogPostsWithSource (static fallback)", () => {
  it("returns posts and source=static when AppFlowy is not configured", async () => {
    const result = await getBlogPostsWithSource();
    expect(result.source).toBe("static");
    expect(Array.isArray(result.posts)).toBe(true);
    expect(result.posts.length).toBeGreaterThan(0);
  });

  it("each post has required fields", async () => {
    const { posts } = await getBlogPostsWithSource();
    for (const p of posts) {
      expect(typeof p.slug).toBe("string");
      expect(typeof p.title).toBe("string");
      expect(typeof p.date).toBe("string");
    }
  });
});

describe("getBlogPosts", () => {
  it("returns an array of posts", async () => {
    const posts = await getBlogPosts();
    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
  });
});

describe("getBlogPostBySlug", () => {
  it("returns a post for a known slug", async () => {
    const posts = await getBlogPosts();
    const slug = posts[0].slug;
    const post = await getBlogPostBySlug(slug);
    expect(post).toBeDefined();
    expect(post?.slug).toBe(slug);
  });

  it("returns undefined for unknown slug", async () => {
    const post = await getBlogPostBySlug("nonexistent-slug-xyz");
    expect(post).toBeUndefined();
  });
});

describe("getBlogPostsWithSource (merged sources)", () => {
  it("R2 articles do not shadow static posts", async () => {
    const { getR2BlogPosts } = await import("@/lib/blog-r2");
    const r2Mock = vi.mocked(getR2BlogPosts);
    r2Mock.mockResolvedValueOnce([
      {
        slug: "2099-01-01-r2-article",
        title: "R2 article",
        excerpt: "from the datalake",
        date: "2099-01-01",
        readTime: "5 min read",
        category: "Cloud",
        content: "body",
      },
    ]);

    const result = await getBlogPostsWithSource();
    expect(result.posts.some((p) => p.slug === "2099-01-01-r2-article")).toBe(true);
    // Static posts must still be present — regression: R2 used to replace them.
    const { posts: staticPosts } = await import("@/lib/blog");
    for (const sp of staticPosts) {
      expect(result.posts.some((p) => p.slug === sp.slug)).toBe(true);
    }
  });

  it("a slug colliding across sources resolves once", async () => {
    const { posts: staticPosts } = await import("@/lib/blog");
    const { getR2BlogPosts } = await import("@/lib/blog-r2");
    vi.mocked(getR2BlogPosts).mockResolvedValueOnce([
      {
        slug: staticPosts[0].slug,
        title: "R2 override",
        excerpt: "dup",
        date: "2099-01-02",
        readTime: "5 min read",
        category: "Cloud",
        content: "body",
      },
    ]);

    const { posts } = await getBlogPostsWithSource();
    const hits = posts.filter((p) => p.slug === staticPosts[0].slug);
    expect(hits).toHaveLength(1);
    expect(hits[0].title).toBe("R2 override");
  });

  it("merged posts are sorted by date descending", async () => {
    const { getR2BlogPosts } = await import("@/lib/blog-r2");
    vi.mocked(getR2BlogPosts).mockResolvedValueOnce([
      {
        slug: "2099-06-01-newest",
        title: "Newest",
        excerpt: "x",
        date: "2099-06-01",
        readTime: "5 min read",
        category: "Cloud",
        content: "body",
      },
    ]);

    const { posts } = await getBlogPostsWithSource();
    const times = posts.map((p) => new Date(p.date).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(posts[0].slug).toBe("2099-06-01-newest");
  });
});
