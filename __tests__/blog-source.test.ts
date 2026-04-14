import { beforeEach, describe, expect, it, vi } from "vitest";
import { posts as staticPosts } from "@/lib/blog";
import { resetIntegrationCache } from "@/lib/integrations";

const getNotionPostsMock = vi.fn();
const getNotionPostBySlugMock = vi.fn();

vi.mock("@/lib/notion-blog", () => ({
  getPosts: getNotionPostsMock,
  getPostBySlug: getNotionPostBySlugMock,
}));

describe("blog-source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns static posts when Notion is not configured", async () => {
    vi.stubEnv("NOTION_API_KEY", "");
    resetIntegrationCache();
    const { getBlogPosts } = await import("@/lib/blog-source");

    await expect(getBlogPosts()).resolves.toEqual(staticPosts);
  });

  it("maps Notion listing posts into the frontend blog shape", async () => {
    getNotionPostsMock.mockResolvedValueOnce([
      {
        id: "notion-1",
        slug: "notion-post",
        title: "Notion Post",
        excerpt: "Fetched from Notion",
        date: "2026-04-10",
        author: "Cloudless Team",
        tags: ["Analytics"],
        published: true,
      },
    ]);

    const { getBlogPosts } = await import("@/lib/blog-source");
    const posts = await getBlogPosts();

    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      slug: "notion-post",
      title: "Notion Post",
      excerpt: "Fetched from Notion",
      date: "2026-04-10",
      category: "Analytics",
    });
    expect(posts[0].readTime).toMatch(/min read/);
  });

  it("maps a Notion post into renderable markdown-like content", async () => {
    getNotionPostBySlugMock.mockResolvedValueOnce({
      id: "notion-2",
      slug: "notion-detail",
      title: "Detailed Notion Post",
      excerpt: "Long form content",
      date: "2026-04-11",
      author: "Cloudless Team",
      tags: ["Cloud"],
      published: true,
      content: [
        {
          id: "b1",
          type: "paragraph",
          paragraph: { rich_text: [{ plain_text: "Intro paragraph" }] },
        },
        {
          id: "b2",
          type: "heading_2",
          heading_2: { rich_text: [{ plain_text: "Section Title" }] },
        },
        {
          id: "b3",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: [{ plain_text: "First item" }] },
        },
        {
          id: "b4",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: [{ plain_text: "Second item" }] },
        },
      ],
    });

    const { getBlogPostBySlug } = await import("@/lib/blog-source");
    const post = await getBlogPostBySlug("notion-detail");

    expect(post).toBeDefined();
    expect(post?.content).toContain("Intro paragraph");
    expect(post?.content).toContain("## Section Title");
    expect(post?.content).toContain("- First item\n- Second item");
    expect(post?.readTime).toMatch(/min read/);
  });

  it("falls back to static content when Notion lookup fails", async () => {
    getNotionPostBySlugMock.mockRejectedValueOnce(new Error("notion down"));

    const { getBlogPostBySlug } = await import("@/lib/blog-source");
    const post = await getBlogPostBySlug(staticPosts[0].slug);

    expect(post).toEqual(staticPosts[0]);
  });
});
