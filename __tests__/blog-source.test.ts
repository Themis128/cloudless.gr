import { beforeEach, describe, expect, it, vi } from "vitest";
import { posts as staticPosts } from "@/lib/blog";

const getAppFlowyPostsMock = vi.fn();
const getAppFlowyPostBySlugMock = vi.fn();
const isAppFlowyConfiguredMock = vi.fn();

vi.mock("@/lib/appflowy-blog", () => ({
  getPosts: (...a: unknown[]) => getAppFlowyPostsMock(...a),
  getPostBySlug: (...a: unknown[]) => getAppFlowyPostBySlugMock(...a),
}));

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: (...a: unknown[]) => isAppFlowyConfiguredMock(...a),
}));

describe("blog-source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAppFlowyConfiguredMock.mockResolvedValue(false);
  });

  it("returns static posts when AppFlowy is not configured", async () => {
    const { getBlogPosts } = await import("@/lib/blog-source");
    await expect(getBlogPosts()).resolves.toEqual(staticPosts);
  });

  it("maps AppFlowy listing posts into the frontend blog shape", async () => {
    isAppFlowyConfiguredMock.mockResolvedValue(true);
    getAppFlowyPostsMock.mockResolvedValueOnce([
      {
        slug: "appflowy-post",
        title: "AppFlowy Post",
        excerpt: "Fetched from AppFlowy",
        date: "2026-04-10",
        category: "Analytics",
        published: true,
        readTime: "3 min read",
        html: "<p>hi</p>",
      },
    ]);

    const { getBlogPosts } = await import("@/lib/blog-source");
    const posts = await getBlogPosts();

    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      slug: "appflowy-post",
      title: "AppFlowy Post",
      excerpt: "Fetched from AppFlowy",
      date: "2026-04-10",
      category: "Analytics",
    });
  });

  it("maps an AppFlowy post into plain text content", async () => {
    isAppFlowyConfiguredMock.mockResolvedValue(true);
    getAppFlowyPostBySlugMock.mockResolvedValueOnce({
      slug: "detail",
      title: "Detailed Post",
      excerpt: "Long form content",
      date: "2026-04-11",
      category: "Cloud",
      published: true,
      readTime: "4 min read",
      html: "<p>Intro paragraph</p><h2>Section Title</h2>",
    });

    const { getBlogPostBySlug } = await import("@/lib/blog-source");
    const post = await getBlogPostBySlug("detail");

    expect(post).toBeDefined();
    expect(post?.content).toContain("Intro paragraph");
    expect(post?.content).toContain("Section Title");
  });

  it("falls back to static when AppFlowy returns an empty list", async () => {
    isAppFlowyConfiguredMock.mockResolvedValue(true);
    getAppFlowyPostsMock.mockResolvedValueOnce([]);

    const { getBlogPosts } = await import("@/lib/blog-source");
    await expect(getBlogPosts()).resolves.toEqual(staticPosts);
  });

  it("falls back to static content when AppFlowy lookup fails", async () => {
    isAppFlowyConfiguredMock.mockResolvedValue(true);
    getAppFlowyPostBySlugMock.mockRejectedValueOnce(new Error("cms down"));

    const { getBlogPostBySlug } = await import("@/lib/blog-source");
    const post = await getBlogPostBySlug(staticPosts[0].slug);

    expect(post).toEqual(staticPosts[0]);
  });
});
