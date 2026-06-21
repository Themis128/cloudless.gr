import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetIntegrationCache } from "@/lib/integrations";

vi.mock("@/lib/notion-cache", () => ({
  cached: async (_key: string, fetcher: () => Promise<unknown>) => fetcher(),
  invalidateCache: vi.fn(),
}));

const mockNotionFetchAll = vi.fn();
const mockFetchBlocksDeep = vi.fn();
const mockBlocksToHtml = vi.fn().mockReturnValue("<p>Rendered content</p>");

vi.mock("@/lib/notion", () => ({
  notionFetchAll: (...args: unknown[]) => mockNotionFetchAll(...args),
  fetchBlocksDeep: (...args: unknown[]) => mockFetchBlocksDeep(...args),
  blocksToHtml: (...args: unknown[]) => mockBlocksToHtml(...args),
  notionImageProxyUrl: (id: string, type?: string) =>
    `/api/notion-image?id=${id}&type=${type ?? "block"}`,
  extractText: (rt: { plain_text: string }[] | undefined) =>
    (rt ?? []).map((t) => t.plain_text).join(""),
}));

function makeCaseStudyPage(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs-abc",
    created_time: "2026-01-15T00:00:00Z",
    cover: null,
    properties: {
      Title: { title: [{ plain_text: "55% AWS Cost Reduction" }] },
      Slug: { rich_text: [{ plain_text: "techflow-aws-cost-reduction" }] },
      Client: { rich_text: [{ plain_text: "TechFlow Athens" }] },
      Industry: { select: { name: "SaaS" } },
      Services: { multi_select: [{ name: "Cloud Audit" }, { name: "Cost Optimization" }] },
      Summary: { rich_text: [{ plain_text: "Cut AWS spend by 55% in 30 days." }] },
      Challenge: { rich_text: [{ plain_text: "High AWS spend with no visibility." }] },
      Solution: { rich_text: [{ plain_text: "Right-sized EC2 and migrated to Lambda." }] },
      Results: { rich_text: [{ plain_text: "Bill dropped from €8k to €3.6k." }] },
      Metric1Label: { rich_text: [{ plain_text: "Cost reduction" }] },
      Metric1Value: { rich_text: [{ plain_text: "55%" }] },
      Metric2Label: { rich_text: [{ plain_text: "Time to results" }] },
      Metric2Value: { rich_text: [{ plain_text: "30 days" }] },
      Metric3Label: { rich_text: [] },
      Metric3Value: { rich_text: [] },
      CoverImage: { url: "https://example.com/cover.jpg" },
      Tags: { multi_select: [{ name: "AWS" }, { name: "Cost optimization" }] },
      Featured: { checkbox: true },
      Published: { checkbox: true },
      Date: { date: { start: "2026-03-01" } },
    },
    ...overrides,
  };
}

describe("notion-case-studies.ts", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
    process.env.NOTION_API_KEY = "test-key";
    process.env.NOTION_CASE_STUDIES_DB_ID = "test-case-studies-db";
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe("getCaseStudies", () => {
    it("returns mapped case studies", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeCaseStudyPage()]);

      const { getCaseStudies } = await import("@/lib/notion-case-studies");
      const studies = await getCaseStudies();

      expect(studies).toHaveLength(1);
      const cs = studies[0];
      expect(cs.id).toBe("cs-abc");
      expect(cs.slug).toBe("techflow-aws-cost-reduction");
      expect(cs.title).toBe("55% AWS Cost Reduction");
      expect(cs.client).toBe("TechFlow Athens");
      expect(cs.industry).toBe("SaaS");
      expect(cs.services).toEqual(["Cloud Audit", "Cost Optimization"]);
      expect(cs.summary).toBe("Cut AWS spend by 55% in 30 days.");
      expect(cs.coverImage).toBe("https://example.com/cover.jpg");
      expect(cs.tags).toEqual(["AWS", "Cost optimization"]);
      expect(cs.featured).toBe(true);
      expect(cs.date).toBe("2026-03-01");
    });

    it("maps metrics (skips entries missing label or value)", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeCaseStudyPage()]);

      const { getCaseStudies } = await import("@/lib/notion-case-studies");
      const [cs] = await getCaseStudies();

      expect(cs.metrics).toHaveLength(2);
      expect(cs.metrics[0]).toEqual({ label: "Cost reduction", value: "55%" });
      expect(cs.metrics[1]).toEqual({ label: "Time to results", value: "30 days" });
    });

    it("falls back to page.id as slug when Slug is empty", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeCaseStudyPage({
          properties: { ...makeCaseStudyPage().properties, Slug: { rich_text: [] } },
        }),
      ]);

      const { getCaseStudies } = await import("@/lib/notion-case-studies");
      const [cs] = await getCaseStudies();
      expect(cs.slug).toBe("cs-abc");
    });

    it("queries with Published=true and descending Date sort", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { getCaseStudies } = await import("@/lib/notion-case-studies");
      await getCaseStudies();

      const [, body] = mockNotionFetchAll.mock.calls[0];
      expect(body.filter).toEqual({ property: "Published", checkbox: { equals: true } });
      expect(body.sorts).toEqual([{ property: "Date", direction: "descending" }]);
    });

    it("throws when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();

      const { getCaseStudies } = await import("@/lib/notion-case-studies");
      await expect(getCaseStudies()).rejects.toThrow();
      expect(mockNotionFetchAll).not.toHaveBeenCalled();
    });

    it("returns empty array on fetch error", async () => {
      mockNotionFetchAll.mockRejectedValueOnce(new Error("Notion down"));

      const { getCaseStudies } = await import("@/lib/notion-case-studies");
      const result = await getCaseStudies();

      expect(result).toEqual([]);
      expect(errorSpy).toHaveBeenCalledWith(
        "[Notion Case Studies] Failed to fetch:",
        expect.any(Error)
      );
    });

    it("falls back to page cover when CoverImage is absent", async () => {
      const page = makeCaseStudyPage({
        cover: { external: { url: "https://cover-from-page.com/img.jpg" } },
        properties: { ...makeCaseStudyPage().properties, CoverImage: { url: null } },
      });
      mockNotionFetchAll.mockResolvedValueOnce([page]);

      const { getCaseStudies } = await import("@/lib/notion-case-studies");
      const [cs] = await getCaseStudies();
      expect(cs.coverImage).toBe("https://cover-from-page.com/img.jpg");
    });
  });

  describe("getFeaturedCaseStudies", () => {
    it("returns only featured studies", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeCaseStudyPage(),
        makeCaseStudyPage({
          id: "cs-2",
          properties: {
            ...makeCaseStudyPage().properties,
            Featured: { checkbox: false },
            Slug: { rich_text: [{ plain_text: "cs-2" }] },
          },
        }),
      ]);

      const { getFeaturedCaseStudies } = await import("@/lib/notion-case-studies");
      const result = await getFeaturedCaseStudies();

      expect(result).toHaveLength(1);
      expect(result[0].featured).toBe(true);
    });
  });

  describe("getCaseStudyBySlug", () => {
    it("returns a case study with rendered HTML", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeCaseStudyPage()]);
      mockFetchBlocksDeep.mockResolvedValueOnce([]);

      const { getCaseStudyBySlug } = await import("@/lib/notion-case-studies");
      const result = await getCaseStudyBySlug("techflow-aws-cost-reduction");

      expect(result).not.toBeNull();
      expect(result!.slug).toBe("techflow-aws-cost-reduction");
      expect(result!.html).toBe("<p>Rendered content</p>");
    });

    it("queries with Slug equals filter", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeCaseStudyPage()]);
      mockFetchBlocksDeep.mockResolvedValueOnce([]);

      const { getCaseStudyBySlug } = await import("@/lib/notion-case-studies");
      await getCaseStudyBySlug("my-slug");

      const [, body] = mockNotionFetchAll.mock.calls[0];
      expect(body.filter.and).toContainEqual({
        property: "Slug",
        rich_text: { equals: "my-slug" },
      });
    });

    it("returns null when slug not found", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { getCaseStudyBySlug } = await import("@/lib/notion-case-studies");
      const result = await getCaseStudyBySlug("nonexistent");

      expect(result).toBeNull();
    });

    it("returns null on error", async () => {
      mockNotionFetchAll.mockRejectedValueOnce(new Error("fail"));

      const { getCaseStudyBySlug } = await import("@/lib/notion-case-studies");
      const result = await getCaseStudyBySlug("any-slug");

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe("getAllCaseStudySlugs", () => {
    it("returns slugs for all case studies", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeCaseStudyPage(),
        makeCaseStudyPage({
          id: "cs-2",
          properties: {
            ...makeCaseStudyPage().properties,
            Slug: { rich_text: [{ plain_text: "retail-serverless" }] },
          },
        }),
      ]);

      const { getAllCaseStudySlugs } = await import("@/lib/notion-case-studies");
      const slugs = await getAllCaseStudySlugs();

      expect(slugs).toEqual(["techflow-aws-cost-reduction", "retail-serverless"]);
    });

    it("filters out empty slugs", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeCaseStudyPage({
          properties: { ...makeCaseStudyPage().properties, Slug: { rich_text: [] } },
        }),
      ]);

      const { getAllCaseStudySlugs } = await import("@/lib/notion-case-studies");
      const slugs = await getAllCaseStudySlugs();

      // Falls back to page.id ("cs-abc") which is truthy — still included
      expect(slugs).toHaveLength(1);
      expect(slugs[0]).toBe("cs-abc");
    });
  });

  describe("staticCaseStudies", () => {
    it("exports a non-empty static fallback array", async () => {
      const { staticCaseStudies } = await import("@/lib/notion-case-studies");
      expect(staticCaseStudies.length).toBeGreaterThan(0);
      expect(staticCaseStudies[0]).toMatchObject({
        slug: expect.any(String),
        title: expect.any(String),
        metrics: expect.any(Array),
      });
    });
  });
});
