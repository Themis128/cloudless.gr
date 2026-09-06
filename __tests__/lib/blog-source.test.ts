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
