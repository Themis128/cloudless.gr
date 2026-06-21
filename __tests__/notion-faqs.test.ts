import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetIntegrationCache } from "@/lib/integrations";

vi.mock("@/lib/notion-cache", () => ({
  cached: async (_key: string, fetcher: () => Promise<unknown>) => fetcher(),
  invalidateCache: vi.fn(),
}));

const mockNotionFetchAll = vi.fn();

vi.mock("@/lib/notion", () => ({
  notionFetchAll: (...args: unknown[]) => mockNotionFetchAll(...args),
  extractText: (rt: { plain_text: string }[] | undefined) =>
    (rt ?? []).map((t) => t.plain_text).join(""),
}));

function makeFaqPage(overrides: Record<string, unknown> = {}) {
  return {
    id: "faq-abc",
    properties: {
      Question: { title: [{ plain_text: "How long does a cloud audit take?" }] },
      Answer: { rich_text: [{ plain_text: "5 business days." }] },
      Category: { select: { name: "process" } },
      Locale: { multi_select: [] },
      Published: { checkbox: true },
    },
    ...overrides,
  };
}

describe("notion-faqs.ts", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
    process.env.NOTION_API_KEY = "test-key";
    process.env.NOTION_FAQS_DB_ID = "test-faqs-db";
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe("getFaqs", () => {
    it("returns mapped FAQs from Notion", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeFaqPage()]);

      const { getFaqs } = await import("@/lib/notion-faqs");
      const faqs = await getFaqs();

      expect(faqs).toHaveLength(1);
      const faq = faqs[0];
      expect(faq.id).toBe("faq-abc");
      expect(faq.question).toBe("How long does a cloud audit take?");
      expect(faq.answer).toBe("5 business days.");
      expect(faq.category).toBe("process");
      expect(faq.locales).toEqual([]);
    });

    it("maps locale multi_select to string array", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeFaqPage({
          properties: {
            ...makeFaqPage().properties,
            Locale: { multi_select: [{ name: "en" }, { name: "el" }] },
          },
        }),
      ]);

      const { getFaqs } = await import("@/lib/notion-faqs");
      const [faq] = await getFaqs();
      expect(faq.locales).toEqual(["en", "el"]);
    });

    it("queries with Published=true filter and ascending Order sort", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeFaqPage()]);

      const { getFaqs } = await import("@/lib/notion-faqs");
      await getFaqs();

      const [, body] = mockNotionFetchAll.mock.calls[0];
      expect(body.filter).toEqual({ property: "Published", checkbox: { equals: true } });
      expect(body.sorts).toEqual([{ property: "Order", direction: "ascending" }]);
    });

    it("falls back to staticFaqs when not configured", async () => {
      process.env.NOTION_FAQS_DB_ID = "";
      resetIntegrationCache();

      const { getFaqs, staticFaqs } = await import("@/lib/notion-faqs");
      const result = await getFaqs();

      expect(result).toEqual(staticFaqs);
      expect(mockNotionFetchAll).not.toHaveBeenCalled();
    });

    it("filters staticFaqs by locale when not configured and locale provided", async () => {
      process.env.NOTION_FAQS_DB_ID = "";
      resetIntegrationCache();

      const { getFaqs, staticFaqs } = await import("@/lib/notion-faqs");
      // staticFaqs all have locales=[] which means "all locales", so they all pass
      const result = await getFaqs("el");
      expect(result).toEqual(staticFaqs);
    });

    it("falls back to staticFaqs when Notion returns empty list", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { getFaqs, staticFaqs } = await import("@/lib/notion-faqs");
      const result = await getFaqs();

      expect(result).toEqual(staticFaqs);
    });

    it("falls back to staticFaqs on fetch error", async () => {
      mockNotionFetchAll.mockRejectedValueOnce(new Error("Notion down"));

      const { getFaqs, staticFaqs } = await import("@/lib/notion-faqs");
      const result = await getFaqs();

      expect(result).toEqual(staticFaqs);
      expect(errorSpy).toHaveBeenCalledWith("[Notion FAQs] Failed to fetch:", expect.any(Error));
    });

    it("filters Notion FAQs by locale when locale provided", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeFaqPage(),
        makeFaqPage({
          id: "faq-el",
          properties: {
            ...makeFaqPage().properties,
            Locale: { multi_select: [{ name: "el" }] },
          },
        }),
        makeFaqPage({
          id: "faq-fr",
          properties: {
            ...makeFaqPage().properties,
            Locale: { multi_select: [{ name: "fr" }] },
          },
        }),
      ]);

      const { getFaqs } = await import("@/lib/notion-faqs");
      const result = await getFaqs("el");

      // faq-abc has locales=[] (all) → included; faq-el has locales=["el"] → included; faq-fr → excluded
      expect(result).toHaveLength(2);
      expect(result.map((f) => f.id)).toContain("faq-abc");
      expect(result.map((f) => f.id)).toContain("faq-el");
    });

    it("defaults category to 'general' when Category property is absent", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeFaqPage({ properties: { ...makeFaqPage().properties, Category: {} } }),
      ]);

      const { getFaqs } = await import("@/lib/notion-faqs");
      const [faq] = await getFaqs();
      expect(faq.category).toBe("general");
    });
  });

  describe("getFaqsByCategory", () => {
    it("returns FAQs filtered by category", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeFaqPage(),
        makeFaqPage({
          id: "faq-2",
          properties: {
            ...makeFaqPage().properties,
            Question: { title: [{ plain_text: "What is the minimum engagement?" }] },
            Category: { select: { name: "pricing" } },
          },
        }),
      ]);

      const { getFaqsByCategory } = await import("@/lib/notion-faqs");
      const result = await getFaqsByCategory("process");

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("process");
    });

    it("returns empty array when no FAQs match category", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeFaqPage()]);

      const { getFaqsByCategory } = await import("@/lib/notion-faqs");
      const result = await getFaqsByCategory("technical");

      expect(result).toHaveLength(0);
    });

    it("forwards locale to getFaqs", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        // "el" FAQ — passes locale filter
        makeFaqPage({
          id: "faq-el",
          properties: {
            ...makeFaqPage().properties,
            Locale: { multi_select: [{ name: "el" }] },
          },
        }),
        // "fr" FAQ — excluded by locale filter
        makeFaqPage({
          id: "faq-fr",
          properties: {
            ...makeFaqPage().properties,
            Locale: { multi_select: [{ name: "fr" }] },
          },
        }),
      ]);

      const { getFaqsByCategory } = await import("@/lib/notion-faqs");
      const result = await getFaqsByCategory("process", "el");

      // faq-fr (locale=["fr"]) filtered out; faq-el (locale=["el"]) passes
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("faq-el");
    });
  });

  describe("staticFaqs", () => {
    it("exports a non-empty static fallback array", async () => {
      const { staticFaqs } = await import("@/lib/notion-faqs");
      expect(staticFaqs.length).toBeGreaterThan(0);
      expect(staticFaqs[0]).toMatchObject({
        id: expect.any(String),
        question: expect.any(String),
        answer: expect.any(String),
        category: expect.any(String),
        locales: expect.any(Array),
      });
    });
  });
});
