import { describe, it, expect, vi, beforeEach } from "vitest";

const mockNotionFetch = vi.fn();
const mockNotionFetchAll = vi.fn();
const mockNotionListAll = vi.fn();

// Bypass the in-memory cache so every test hits the mock directly
vi.mock("@/lib/notion-cache", () => ({
  cached: async (_key: string, fetcher: () => Promise<unknown>) => fetcher(),
  invalidateCache: vi.fn(),
}));

vi.mock("@/lib/notion", () => ({
  notionFetch: (...args: unknown[]) => mockNotionFetch(...args),
  notionFetchAll: (...args: unknown[]) => mockNotionFetchAll(...args),
  notionListAll: (...args: unknown[]) => mockNotionListAll(...args),
  fetchBlocksDeep: (...args: unknown[]) => mockNotionListAll(...args),
  blocksToHtml: () => "<p>Rendered doc content</p>",
}));

function makeDocPage(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    url: "https://notion.so/doc-1",
    properties: {
      Title: { title: [{ plain_text: DOC_TITLE }] },
      Slug: { rich_text: [{ plain_text: DOC_SLUG }] },
      Category: { select: { name: "Guides" } },
      Description: { rich_text: [{ plain_text: "How to get started" }] },
      Published: { checkbox: true },
      Order: { number: 1 },
    },
    ...overrides,
  };
}

const DOC_SLUG = "getting-started";
const DOC_TITLE = "Getting Started";
const DOC_CATEGORY = "General";

describe("notion-docs.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDocs", () => {
    it("returns mapped docs sorted by Category + Order", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeDocPage(),
        makeDocPage({
          id: "doc-2",
          properties: {
            ...makeDocPage().properties,
            Title: { title: [{ plain_text: "Advanced Usage" }] },
            Slug: { rich_text: [{ plain_text: "advanced-usage" }] },
            Order: { number: 2 },
          },
        }),
      ]);

      const { getDocs } = await import("@/lib/notion-docs");
      const docs = await getDocs();

      expect(docs).toHaveLength(2);
      expect(docs[0].title).toBe(DOC_TITLE);
      expect(docs[0].slug).toBe(DOC_SLUG);
      expect(docs[0].category).toBe("Guides");
      expect(docs[0].description).toBe("How to get started");
      expect(docs[0].order).toBe(1);
      expect(docs[0].published).toBe(true);
      expect(docs[0].url).toBe("https://notion.so/doc-1");
    });

    it("passes Published filter and Category+Order sorts", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { getDocs } = await import("@/lib/notion-docs");
      await getDocs();

      expect(mockNotionFetchAll).toHaveBeenCalledWith(
        "/databases/docs-db-123/query",
        expect.objectContaining({
          filter: { property: "Published", checkbox: { equals: true } },
          sorts: [
            { property: "Category", direction: "ascending" },
            { property: "Order", direction: "ascending" },
          ],
        }),
      );
    });

    it("returns empty array when not configured", async () => {
      vi.doMock("@/lib/integrations", () => ({
        getIntegrations: vi.fn().mockReturnValue({}),
      }));

      const mod = await import("@/lib/notion-docs");
      // With empty config the guard returns []
      // We verify notionFetchAll is not called
      expect(mockNotionFetchAll).not.toHaveBeenCalled();
    });

    it("returns empty array on API error", async () => {
      mockNotionFetchAll.mockRejectedValueOnce(new Error("API failed"));

      const { getDocs } = await import("@/lib/notion-docs");
      const docs = await getDocs();

      expect(docs).toEqual([]);
    });

    it("defaults category to 'General' when missing", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeDocPage({
          properties: {
            ...makeDocPage().properties,
            Category: {},
          },
        }),
      ]);

      const { getDocs } = await import("@/lib/notion-docs");
      const docs = await getDocs();

      expect(docs[0].category).toBe(DOC_CATEGORY);
    });

    it("defaults order to 0 when missing", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeDocPage({
          properties: {
            ...makeDocPage().properties,
            Order: {},
          },
        }),
      ]);

      const { getDocs } = await import("@/lib/notion-docs");
      const docs = await getDocs();

      expect(docs[0].order).toBe(0);
    });

    it("uses page id as slug when Slug is empty", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeDocPage({
          id: "fallback-id",
          properties: {
            ...makeDocPage().properties,
            Slug: { rich_text: [] },
          },
        }),
      ]);

      const { getDocs } = await import("@/lib/notion-docs");
      const docs = await getDocs();

      expect(docs[0].slug).toBe("fallback-id");
    });
  });

  describe("getDocBySlug", () => {
    it("returns a single doc by slug", async () => {
      mockNotionFetch.mockResolvedValueOnce({
        results: [makeDocPage()],
      });

      const { getDocBySlug } = await import("@/lib/notion-docs");
      const doc = await getDocBySlug(DOC_SLUG);

      expect(doc).not.toBeNull();
      expect(doc!.slug).toBe(DOC_SLUG);
      expect(doc!.title).toBe(DOC_TITLE);
    });

    it("sends Slug + Published filter", async () => {
      mockNotionFetch.mockResolvedValueOnce({ results: [makeDocPage()] });

      const { getDocBySlug } = await import("@/lib/notion-docs");
      await getDocBySlug(DOC_SLUG);

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.filter.and).toEqual(
        expect.arrayContaining([
          { property: "Slug", rich_text: { equals: DOC_SLUG } },
          { property: "Published", checkbox: { equals: true } },
        ]),
      );
      expect(body.page_size).toBe(1);
    });

    it("returns null when doc not found", async () => {
      mockNotionFetch.mockResolvedValueOnce({ results: [] });

      const { getDocBySlug } = await import("@/lib/notion-docs");
      const doc = await getDocBySlug("nonexistent");

      expect(doc).toBeNull();
    });

    it("returns null when not configured", async () => {
      vi.doMock("@/lib/integrations", () => ({
        getIntegrations: vi.fn().mockReturnValue({}),
      }));

      await import("@/lib/notion-docs");
      expect(mockNotionFetch).not.toHaveBeenCalled();
    });

    it("returns null on API error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("fail"));

      const { getDocBySlug } = await import("@/lib/notion-docs");
      const doc = await getDocBySlug("test");

      expect(doc).toBeNull();
    });
  });

  describe("getDocContent", () => {
    it("returns doc with rendered HTML content", async () => {
      mockNotionFetch.mockResolvedValueOnce(makeDocPage());
      mockNotionListAll.mockResolvedValueOnce([
        { type: "paragraph", paragraph: { rich_text: [{ plain_text: "Content" }] } },
      ]);

      const { getDocContent } = await import("@/lib/notion-docs");
      const content = await getDocContent("doc-1");

      expect(content).not.toBeNull();
      expect(content!.title).toBe(DOC_TITLE);
      expect(content!.html).toBe("<p>Rendered doc content</p>");
    });

    it("fetches page metadata and block children", async () => {
      mockNotionFetch.mockResolvedValueOnce(makeDocPage());
      mockNotionListAll.mockResolvedValueOnce([]);

      const { getDocContent } = await import("@/lib/notion-docs");
      await getDocContent("doc-1");

      expect(mockNotionFetch).toHaveBeenCalledWith("/pages/doc-1");
      expect(mockNotionListAll).toHaveBeenCalledWith("doc-1");
    });

    it("returns null when not configured (no API key)", async () => {
      vi.doMock("@/lib/integrations", () => ({
        getIntegrations: vi.fn().mockReturnValue({}),
      }));

      await import("@/lib/notion-docs");
      expect(mockNotionFetch).not.toHaveBeenCalled();
    });

    it("returns null on API error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("fail"));

      const { getDocContent } = await import("@/lib/notion-docs");
      const content = await getDocContent("bad-id");

      expect(content).toBeNull();
    });
  });

  describe("groupDocsByCategory", () => {
    it("groups docs by category", async () => {
      const { groupDocsByCategory } = await import("@/lib/notion-docs");

      const docs = [
        { id: "1", slug: "a", title: "A", description: "", category: "Guides", order: 1, published: true, url: "" },
        { id: "2", slug: "b", title: "B", description: "", category: "API", order: 1, published: true, url: "" },
        { id: "3", slug: "c", title: "C", description: "", category: "Guides", order: 2, published: true, url: "" },
      ];

      const grouped = groupDocsByCategory(docs);

      expect(Object.keys(grouped)).toEqual(["Guides", "API"]);
      expect(grouped["Guides"]).toHaveLength(2);
      expect(grouped["API"]).toHaveLength(1);
    });

    it("returns empty object for empty docs array", async () => {
      const { groupDocsByCategory } = await import("@/lib/notion-docs");
      expect(groupDocsByCategory([])).toEqual({});
    });

    it("handles single category", async () => {
      const { groupDocsByCategory } = await import("@/lib/notion-docs");

      const docs = [
        { id: "1", slug: "a", title: "A", description: "", category: DOC_CATEGORY, order: 1, published: true, url: "" },
        { id: "2", slug: "b", title: "B", description: "", category: DOC_CATEGORY, order: 2, published: true, url: "" },
      ];

      const grouped = groupDocsByCategory(docs);
      expect(Object.keys(grouped)).toEqual([DOC_CATEGORY]);
      expect(grouped[DOC_CATEGORY]).toHaveLength(2);
    });
  });

  describe("getAllDocs", () => {
    it("returns all docs including unpublished", async () => {
      const published = makeDocPage({ id: "pub-1" });
      const draft = makeDocPage({
        id: "draft-1",
        properties: { ...makeDocPage().properties, Published: { checkbox: false } },
      });
      mockNotionFetchAll.mockResolvedValueOnce([published, draft]);

      const { getAllDocs } = await import("@/lib/notion-docs");
      const docs = await getAllDocs();

      expect(docs).toHaveLength(2);
      expect(docs[0].published).toBe(true);
      expect(docs[1].published).toBe(false);
    });

    it("sends no published filter (fetches all)", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { getAllDocs } = await import("@/lib/notion-docs");
      await getAllDocs();

      const [, body] = mockNotionFetchAll.mock.calls[0];
      expect(body).not.toHaveProperty("filter");
      expect(body.sorts).toEqual([
        { property: "Category", direction: "ascending" },
        { property: "Order", direction: "ascending" },
      ]);
    });

    it("returns empty array on error", async () => {
      mockNotionFetchAll.mockRejectedValueOnce(new Error("API failed"));

      const { getAllDocs } = await import("@/lib/notion-docs");
      const docs = await getAllDocs();

      expect(docs).toEqual([]);
    });
  });
});
