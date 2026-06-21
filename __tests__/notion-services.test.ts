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

function makeServicePage(overrides: Record<string, unknown> = {}) {
  return {
    id: "svc-abc",
    properties: {
      Name: { title: [{ plain_text: "Cloud Audit" }] },
      Slug: { rich_text: [{ plain_text: "cloud-audit" }] },
      Description: { rich_text: [{ plain_text: "Deep-dive infrastructure review." }] },
      Price: { rich_text: [{ plain_text: "From €1,500" }] },
      Category: { select: { name: "audit" } },
      Features: {
        rich_text: [{ plain_text: "Full cost breakdown\n- Security report\n• Roadmap" }],
      },
      CTA: { rich_text: [{ plain_text: "Book an audit" }] },
      Icon: { rich_text: [{ plain_text: "🔍" }] },
      StripePriceId: { rich_text: [] },
      Published: { checkbox: true },
    },
    ...overrides,
  };
}

describe("notion-services.ts", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
    process.env.NOTION_API_KEY = "test-key";
    process.env.NOTION_SERVICES_DB_ID = "test-services-db";
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe("getServices", () => {
    it("returns mapped services from Notion", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeServicePage()]);

      const { getServices } = await import("@/lib/notion-services");
      const services = await getServices();

      expect(services).toHaveLength(1);
      const svc = services[0];
      expect(svc.id).toBe("svc-abc");
      expect(svc.slug).toBe("cloud-audit");
      expect(svc.name).toBe("Cloud Audit");
      expect(svc.description).toBe("Deep-dive infrastructure review.");
      expect(svc.price).toBe("From €1,500");
      expect(svc.category).toBe("audit");
      expect(svc.cta).toBe("Book an audit");
      expect(svc.icon).toBe("🔍");
    });

    it("splits newline-separated features and strips bullet prefixes", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeServicePage()]);

      const { getServices } = await import("@/lib/notion-services");
      const [svc] = await getServices();

      expect(svc.features).toEqual(["Full cost breakdown", "Security report", "Roadmap"]);
    });

    it("falls back to staticServices when not configured", async () => {
      process.env.NOTION_SERVICES_DB_ID = "";
      resetIntegrationCache();

      const { getServices, staticServices } = await import("@/lib/notion-services");
      const result = await getServices();

      expect(result).toEqual(staticServices);
      expect(mockNotionFetchAll).not.toHaveBeenCalled();
    });

    it("falls back to staticServices when Notion returns empty list", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { getServices, staticServices } = await import("@/lib/notion-services");
      const result = await getServices();

      expect(result).toEqual(staticServices);
    });

    it("falls back to staticServices on fetch error", async () => {
      mockNotionFetchAll.mockRejectedValueOnce(new Error("Notion down"));

      const { getServices, staticServices } = await import("@/lib/notion-services");
      const result = await getServices();

      expect(result).toEqual(staticServices);
      expect(errorSpy).toHaveBeenCalledWith(
        "[Notion Services] Failed to fetch:",
        expect.any(Error)
      );
    });

    it("queries with Published=true filter and ascending Order sort", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeServicePage()]);

      const { getServices } = await import("@/lib/notion-services");
      await getServices();

      const [, body] = mockNotionFetchAll.mock.calls[0];
      expect(body.filter).toEqual({ property: "Published", checkbox: { equals: true } });
      expect(body.sorts).toEqual([{ property: "Order", direction: "ascending" }]);
    });

    it("omits stripePriceId when empty", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeServicePage()]);

      const { getServices } = await import("@/lib/notion-services");
      const [svc] = await getServices();
      expect(svc.stripePriceId).toBeUndefined();
    });

    it("includes stripePriceId when present", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeServicePage({
          properties: {
            ...makeServicePage().properties,
            StripePriceId: { rich_text: [{ plain_text: "price_123" }] },
          },
        }),
      ]);

      const { getServices } = await import("@/lib/notion-services");
      const [svc] = await getServices();
      expect(svc.stripePriceId).toBe("price_123");
    });
  });

  describe("getServiceBySlug", () => {
    it("returns matching service", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeServicePage()]);

      const { getServiceBySlug } = await import("@/lib/notion-services");
      const svc = await getServiceBySlug("cloud-audit");

      expect(svc).not.toBeNull();
      expect(svc!.slug).toBe("cloud-audit");
    });

    it("returns null when slug not found", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeServicePage()]);

      const { getServiceBySlug } = await import("@/lib/notion-services");
      const result = await getServiceBySlug("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getServicesByCategory", () => {
    it("filters by category", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeServicePage(),
        makeServicePage({
          id: "svc-2",
          properties: {
            ...makeServicePage().properties,
            Slug: { rich_text: [{ plain_text: "arch-review" }] },
            Category: { select: { name: "consulting" } },
          },
        }),
      ]);

      const { getServicesByCategory } = await import("@/lib/notion-services");
      const result = await getServicesByCategory("audit");

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("audit");
    });

    it("returns empty array when no services match category", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeServicePage()]);

      const { getServicesByCategory } = await import("@/lib/notion-services");
      const result = await getServicesByCategory("training");

      expect(result).toHaveLength(0);
    });
  });

  describe("staticServices", () => {
    it("exports a non-empty static fallback array", async () => {
      const { staticServices } = await import("@/lib/notion-services");
      expect(staticServices.length).toBeGreaterThan(0);
      expect(staticServices[0]).toMatchObject({
        slug: expect.any(String),
        name: expect.any(String),
        features: expect.any(Array),
        category: expect.any(String),
      });
    });
  });
});
