import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetIntegrationCache } from "@/lib/integrations";

// Bypass the in-memory cache so every test hits the mock directly
vi.mock("@/lib/notion-cache", () => ({
  cached: async (_key: string, fetcher: () => Promise<unknown>) => fetcher(),
  invalidateCache: vi.fn(),
}));

// Mock notion client
const mockNotionFetchAll = vi.fn();
const mockNotionListAll = vi.fn();

vi.mock("@/lib/notion", () => ({
  notionFetchAll: (...args: unknown[]) => mockNotionFetchAll(...args),
  notionListAll: (...args: unknown[]) => mockNotionListAll(...args),
  fetchBlocksDeep: (...args: unknown[]) => mockNotionListAll(...args),
  notionImageProxyUrl: (id: string, type?: string) =>
    `/api/notion-image?id=${id}&type=${type ?? "block"}`,
  extractText: (rt: { plain_text: string }[] | undefined) =>
    (rt ?? []).map((t) => t.plain_text).join(""),
  blocksToHtml: () => "<p>Rendered HTML</p>",
}));

// Sample Notion page objects
function makePage(overrides: Record<string, unknown> = {}) {
  return {
    id: "page-1",
    created_time: "2026-01-01T00:00:00Z",
    url: "https://notion.so/page-1",
    cover: null,
    properties: {
      Title: { title: [{ plain_text: "Test Post" }] },
      Slug: { rich_text: [{ plain_text: TEST_SLUG }] },
      Excerpt: { rich_text: [{ plain_text: "A test excerpt" }] },
      Date: { date: { start: "2026-04-01" } },
      Author: { people: [{ name: "Themis" }] },
      Category: { select: { name: "Cloud" } },
      Tags: { multi_select: [{ name: "aws" }, { name: CATEGORY_SERVERLESS }] },
      Published: { checkbox: true },
      Featured: { checkbox: false },
      "Cover Image": { url: "https://img.example.com/cover.jpg" },
      "Read Time": { rich_text: [{ plain_text: "5 min read" }] },
      "SEO Title": { rich_text: [] },
      "SEO Description": { rich_text: [] },
    },
    ...overrides,
  };
}

const TEST_SLUG = "test-post";
const CATEGORY_SERVERLESS = "serverless";

describe("notion-blog.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
  });

  describe("getPosts", () => {
    it("returns mapped posts from Notion", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makePage(), makePage({ id: "page-2" })]);

      const { getPosts } = await import("@/lib/notion-blog");
      const posts = await getPosts();

      expect(posts).toHaveLength(2);
      expect(posts[0].title).toBe("Test Post");
      expect(posts[0].slug).toBe(TEST_SLUG);
      expect(posts[0].category).toBe("Cloud");
      expect(posts[0].tags).toEqual(["aws", CATEGORY_SERVERLESS]);
      expect(posts[0].author).toBe("Themis");
      expect(posts[0].coverImage).toBe("https://img.example.com/cover.jpg");
    });

    it("passes Published filter and Date sort", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { getPosts } = await import("@/lib/notion-blog");
      await getPosts();

      expect(mockNotionFetchAll).toHaveBeenCalledWith(
        "/databases/blog-db-123/query",
        expect.objectContaining({
          filter: { property: "Published", checkbox: { equals: true } },
          sorts: [{ property: "Date", direction: "descending" }],
        }),
      );
    });

    it("returns empty array when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();

      const { getPosts } = await import("@/lib/notion-blog");
      const posts = await getPosts();

      expect(posts).toEqual([]);
      expect(mockNotionFetchAll).not.toHaveBeenCalled();
    });

    it("returns empty array on error", async () => {
      mockNotionFetchAll.mockRejectedValueOnce(new Error("API error"));

      const { getPosts } = await import("@/lib/notion-blog");
      const posts = await getPosts();

      expect(posts).toEqual([]);
    });
  });

  describe("getFeaturedPosts", () => {
    it("filters for Published AND Featured", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { getFeaturedPosts } = await import("@/lib/notion-blog");
      await getFeaturedPosts();

      const callBody = mockNotionFetchAll.mock.calls[0][1];
      expect(callBody.filter.and).toEqual(
        expect.arrayContaining([
          { property: "Published", checkbox: { equals: true } },
          { property: "Featured", checkbox: { equals: true } },
        ]),
      );
    });
  });

  describe("getPostsByCategory", () => {
    it("filters by category", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { getPostsByCategory } = await import("@/lib/notion-blog");
      await getPostsByCategory("Cloud");

      const callBody = mockNotionFetchAll.mock.calls[0][1];
      expect(callBody.filter.and).toEqual(
        expect.arrayContaining([
          { property: "Category", select: { equals: "Cloud" } },
        ]),
      );
    });
  });

  describe("getPostsByTag", () => {
    it("filters by tag", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { getPostsByTag } = await import("@/lib/notion-blog");
      await getPostsByTag(CATEGORY_SERVERLESS);

      const callBody = mockNotionFetchAll.mock.calls[0][1];
      expect(callBody.filter.and).toEqual(
        expect.arrayContaining([
          { property: "Tags", multi_select: { contains: CATEGORY_SERVERLESS } },
        ]),
      );
    });
  });

  describe("getPostBySlug", () => {
    it("returns post with HTML content", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makePage()]);
      mockNotionListAll.mockResolvedValueOnce([
        { type: "paragraph", paragraph: { rich_text: [{ plain_text: "Content" }] } },
      ]);

      const { getPostBySlug } = await import("@/lib/notion-blog");
      const post = await getPostBySlug(TEST_SLUG);

      expect(post).not.toBeNull();
      expect(post!.slug).toBe(TEST_SLUG);
      expect(post!.html).toBe("<p>Rendered HTML</p>");
    });

    it("returns null when post not found", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { getPostBySlug } = await import("@/lib/notion-blog");
      const post = await getPostBySlug("nonexistent");

      expect(post).toBeNull();
    });

    it("returns null when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();

      const { getPostBySlug } = await import("@/lib/notion-blog");
      const post = await getPostBySlug(TEST_SLUG);

      expect(post).toBeNull();
    });
  });

  describe("getAllSlugs", () => {
    it("returns array of slugs", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makePage(),
        makePage({ id: "page-2", properties: { ...makePage().properties, Slug: { rich_text: [{ plain_text: "second-post" }] } } }),
      ]);

      const { getAllSlugs } = await import("@/lib/notion-blog");
      const slugs = await getAllSlugs();

      expect(slugs).toContain(TEST_SLUG);
      expect(slugs).toContain("second-post");
    });

    it("returns empty when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();

      const { getAllSlugs } = await import("@/lib/notion-blog");
      expect(await getAllSlugs()).toEqual([]);
    });
  });

  describe("getCategories", () => {
    it("returns unique categories", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makePage(),
        makePage({ id: "p2", properties: { ...makePage().properties, Category: { select: { name: "DevOps" } } } }),
        makePage({ id: "p3", properties: { ...makePage().properties, Category: { select: { name: "Cloud" } } } }),
      ]);

      const { getCategories } = await import("@/lib/notion-blog");
      const cats = await getCategories();

      expect(cats).toContain("Cloud");
      expect(cats).toContain("DevOps");
      expect(cats).toHaveLength(2); // Cloud appears twice but should be unique
    });
  });

  describe("getTags", () => {
    it("returns unique tags from all posts", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makePage(),
        makePage({
          id: "p2",
          properties: {
            ...makePage().properties,
            Tags: { multi_select: [{ name: CATEGORY_SERVERLESS }, { name: "docker" }] },
          },
        }),
      ]);

      const { getTags } = await import("@/lib/notion-blog");
      const tags = await getTags();

      expect(tags).toContain("aws");
      expect(tags).toContain(CATEGORY_SERVERLESS);
      expect(tags).toContain("docker");
      // CATEGORY_SERVERLESS appears in both posts but should be unique
      const serverlessCount = tags.filter((t: string) => t === "serverless").length;
      expect(serverlessCount).toBe(1);
    });
  });

  describe("mapPage edge cases", () => {
    it("defaults author to 'Cloudless Team' when missing", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makePage({
          properties: {
            ...makePage().properties,
            Author: { people: [] },
          },
        }),
      ]);

      const { getPosts } = await import("@/lib/notion-blog");
      const posts = await getPosts();

      expect(posts[0].author).toBe("Cloudless Team");
    });

    it("defaults category to 'General' when missing", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makePage({
          properties: {
            ...makePage().properties,
            Category: {},
          },
        }),
      ]);

      const { getPosts } = await import("@/lib/notion-blog");
      const posts = await getPosts();

      expect(posts[0].category).toBe("General");
    });

    it("defaults readTime to '5 min read' when missing", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makePage({
          properties: {
            ...makePage().properties,
            "Read Time": { rich_text: [] },
          },
        }),
      ]);

      const { getPosts } = await import("@/lib/notion-blog");
      const posts = await getPosts();

      expect(posts[0].readTime).toBe("5 min read");
    });

    it("falls back to page.id as slug when Slug is empty", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makePage({
          id: "fallback-page-id",
          properties: {
            ...makePage().properties,
            Slug: { rich_text: [] },
          },
        }),
      ]);

      const { getPosts } = await import("@/lib/notion-blog");
      const posts = await getPosts();

      expect(posts[0].slug).toBe("fallback-page-id");
    });

    it("uses cover from page object when Cover Image property is missing", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makePage({
          cover: { external: { url: "https://cover.example.com/bg.jpg" } },
          properties: {
            ...makePage().properties,
            "Cover Image": {},
          },
        }),
      ]);

      const { getPosts } = await import("@/lib/notion-blog");
      const posts = await getPosts();

      expect(posts[0].coverImage).toBe("https://cover.example.com/bg.jpg");
    });

    it("uses created_time as date when Date property is missing", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makePage({
          created_time: "2026-03-15T10:00:00Z",
          properties: {
            ...makePage().properties,
            Date: {},
          },
        }),
      ]);

      const { getPosts } = await import("@/lib/notion-blog");
      const posts = await getPosts();

      expect(posts[0].date).toBe("2026-03-15T10:00:00Z");
    });

    it("returns empty tags when multi_select is missing", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makePage({
          properties: {
            ...makePage().properties,
            Tags: {},
          },
        }),
      ]);

      const { getPosts } = await import("@/lib/notion-blog");
      const posts = await getPosts();

      expect(posts[0].tags).toEqual([]);
    });

    it("maps seoTitle and seoDescription when present", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makePage({
          properties: {
            ...makePage().properties,
            "SEO Title": { rich_text: [{ plain_text: "Custom SEO Title" }] },
            "SEO Description": { rich_text: [{ plain_text: "Custom SEO description" }] },
          },
        }),
      ]);

      const { getPosts } = await import("@/lib/notion-blog");
      const posts = await getPosts();

      expect(posts[0].seoTitle).toBe("Custom SEO Title");
      expect(posts[0].seoDescription).toBe("Custom SEO description");
    });

    it("seoTitle and seoDescription are undefined when empty", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makePage()]);

      const { getPosts } = await import("@/lib/notion-blog");
      const posts = await getPosts();

      expect(posts[0].seoTitle).toBeUndefined();
      expect(posts[0].seoDescription).toBeUndefined();
    });
  });

  describe("getAllPosts", () => {
    it("returns all posts including drafts", async () => {
      const published = makePage({ id: "pub-1" });
      const draft = makePage({
        id: "draft-1",
        properties: { ...makePage().properties, Published: { checkbox: false } },
      });
      mockNotionFetchAll.mockResolvedValueOnce([published, draft]);

      const { getAllPosts } = await import("@/lib/notion-blog");
      const posts = await getAllPosts();

      expect(posts).toHaveLength(2);
      expect(posts[0].published).toBe(true);
      expect(posts[1].published).toBe(false);
    });

    it("sends no published filter (fetches all)", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { getAllPosts } = await import("@/lib/notion-blog");
      await getAllPosts();

      const [, body] = mockNotionFetchAll.mock.calls[0];
      expect(body).not.toHaveProperty("filter");
      expect(body.sorts).toEqual([{ property: "Date", direction: "descending" }]);
    });

    it("returns empty array when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();

      const { getAllPosts } = await import("@/lib/notion-blog");
      const posts = await getAllPosts();

      expect(posts).toEqual([]);
      expect(mockNotionFetchAll).not.toHaveBeenCalled();
    });

    it("returns empty array on error", async () => {
      mockNotionFetchAll.mockRejectedValueOnce(new Error("API error"));

      const { getAllPosts } = await import("@/lib/notion-blog");
      const posts = await getAllPosts();

      expect(posts).toEqual([]);
    });
  });
});
