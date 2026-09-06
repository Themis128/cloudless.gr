import { describe, it, expect } from "vitest";
import { posts, getPostBySlug, formatDate, type BlogPost } from "@/lib/blog";

describe("posts", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
  });

  it("each post has required fields", () => {
    for (const post of posts) {
      expect(typeof post.slug).toBe("string");
      expect(post.slug.length).toBeGreaterThan(0);
      expect(typeof post.title).toBe("string");
      expect(typeof post.date).toBe("string");
    }
  });

  it("slugs are unique", () => {
    const slugs = posts.map((p) => p.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });
});

describe("getPostBySlug", () => {
  it("returns the post for a valid slug", () => {
    const slug = posts[0].slug;
    const post = getPostBySlug(slug);
    expect(post).toBeDefined();
    expect(post?.slug).toBe(slug);
  });

  it("returns undefined for an unknown slug", () => {
    expect(getPostBySlug("nonexistent-slug-xyz")).toBeUndefined();
  });
});

describe("formatDate", () => {
  it("returns a human-readable date string", () => {
    const result = formatDate("2026-09-01");
    expect(typeof result).toBe("string");
    expect(result).toContain("2026");
    expect(result).toContain("September");
  });

  it("formats different months", () => {
    expect(formatDate("2026-01-15")).toContain("January");
    expect(formatDate("2026-12-25")).toContain("December");
  });
});
