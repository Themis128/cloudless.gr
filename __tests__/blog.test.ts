import { describe, it, expect } from "vitest";
import { posts, getPostBySlug, formatDate } from "@/lib/blog";

describe("blog.ts static catalog", () => {
  describe("posts", () => {
    it("exports a non-empty array", () => {
      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBeGreaterThan(0);
    });

    it("each post has required string fields", () => {
      for (const post of posts) {
        expect(typeof post.slug).toBe("string");
        expect(typeof post.title).toBe("string");
        expect(typeof post.excerpt).toBe("string");
        expect(typeof post.date).toBe("string");
        expect(typeof post.readTime).toBe("string");
        expect(typeof post.content).toBe("string");
        expect(typeof post.category).toBe("string");
      }
    });

    it("slugs are unique", () => {
      const slugs = posts.map((p) => p.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it("dates are valid ISO date strings", () => {
      for (const post of posts) {
        expect(isNaN(new Date(post.date).getTime())).toBe(false);
      }
    });
  });

  describe("getPostBySlug()", () => {
    it("returns the post for a known slug", () => {
      const slug = posts[0].slug;
      const post = getPostBySlug(slug);
      expect(post).toBeDefined();
      expect(post?.slug).toBe(slug);
    });

    it("returns undefined for an unknown slug", () => {
      expect(getPostBySlug("not-a-real-post")).toBeUndefined();
    });

    it("returns the correct post when multiple posts exist", () => {
      for (const expected of posts) {
        const found = getPostBySlug(expected.slug);
        expect(found?.title).toBe(expected.title);
      }
    });
  });

  describe("formatDate()", () => {
    it("formats a date string into a human-readable form", () => {
      const result = formatDate("2026-03-28");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("includes the year in the formatted output", () => {
      expect(formatDate("2026-01-15")).toContain("2026");
    });

    it("handles different months", () => {
      const jan = formatDate("2026-01-01");
      const jul = formatDate("2026-07-01");
      expect(jan).not.toBe(jul);
    });
  });
});
