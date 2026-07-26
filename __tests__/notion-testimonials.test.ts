import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetIntegrationCache } from "@/lib/integrations";

vi.mock("@/lib/notion-cache", () => ({
  cached: async (_key: string, fetcher: () => Promise<unknown>) => fetcher(),
  invalidateCache: vi.fn(),
}));

const mockNotionFetchAll = vi.fn();
const mockCreatePage = vi.fn();
const mockUpdatePage = vi.fn();
const mockArchivePage = vi.fn();

vi.mock("@/lib/notion", () => ({
  notionFetchAll: (...args: unknown[]) => mockNotionFetchAll(...args),
  extractText: (rt: { plain_text: string }[] | undefined) =>
    (rt ?? []).map((t) => t.plain_text).join(""),
  createPage: (...args: unknown[]) => mockCreatePage(...args),
  updatePage: (...args: unknown[]) => mockUpdatePage(...args),
  archivePage: (...args: unknown[]) => mockArchivePage(...args),
}));

function makeTestimonialPage(overrides: Record<string, unknown> = {}) {
  return {
    id: "t-abc",
    properties: {
      Name: { title: [{ plain_text: "Alexandros P." }] },
      Company: { rich_text: [{ plain_text: "TechFlow" }] },
      Role: { rich_text: [{ plain_text: "CTO" }] },
      Quote: { rich_text: [{ plain_text: "Saved us 55% on AWS." }] },
      Avatar: { url: "https://example.com/avatar.jpg" },
      Service: { select: { name: "Cloud Audit" } },
      Rating: { number: 5 },
      Featured: { checkbox: true },
      Published: { checkbox: true },
    },
    ...overrides,
  };
}

describe("notion-testimonials.ts", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
    process.env.NOTION_API_KEY = "test-key";
    process.env.NOTION_TESTIMONIALS_DB_ID = "test-testimonials-db";
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe("getTestimonials", () => {
    it("returns mapped testimonials", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeTestimonialPage()]);

      const { getTestimonials } = await import("@/lib/notion-testimonials");
      const testimonials = await getTestimonials();

      expect(testimonials).toHaveLength(1);
      expect(testimonials[0].id).toBe("t-abc");
      expect(testimonials[0].name).toBe("Alexandros P.");
      expect(testimonials[0].company).toBe("TechFlow");
      expect(testimonials[0].role).toBe("CTO");
      expect(testimonials[0].quote).toBe("Saved us 55% on AWS.");
      expect(testimonials[0].avatar).toBe("https://example.com/avatar.jpg");
      expect(testimonials[0].service).toBe("Cloud Audit");
      expect(testimonials[0].rating).toBe(5);
      expect(testimonials[0].featured).toBe(true);
    });

    it("queries with Published=true filter and ascending Order sort", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { getTestimonials } = await import("@/lib/notion-testimonials");
      await getTestimonials();

      const [, body] = mockNotionFetchAll.mock.calls[0];
      expect(body.filter).toEqual({ property: "Published", checkbox: { equals: true } });
      expect(body.sorts).toEqual([{ property: "Order", direction: "ascending" }]);
    });

    it("throws when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();

      const { getTestimonials } = await import("@/lib/notion-testimonials");
      await expect(getTestimonials()).rejects.toThrow();
      expect(mockNotionFetchAll).not.toHaveBeenCalled();
    });

    it("returns empty array on fetch error", async () => {
      mockNotionFetchAll.mockRejectedValueOnce(new Error("Notion down"));

      const { getTestimonials } = await import("@/lib/notion-testimonials");
      const result = await getTestimonials();

      expect(result).toEqual([]);
      expect(errorSpy).toHaveBeenCalledWith(
        "[Notion Testimonials] Failed to fetch:",
        expect.any(Error)
      );
    });

    it("clamps rating to 1–5 range", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeTestimonialPage({
          properties: { ...makeTestimonialPage().properties, Rating: { number: 10 } },
        }),
      ]);

      const { getTestimonials } = await import("@/lib/notion-testimonials");
      const [t] = await getTestimonials();
      expect(t.rating).toBe(5);
    });

    it("omits rating when not a number", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeTestimonialPage({ properties: { ...makeTestimonialPage().properties, Rating: {} } }),
      ]);

      const { getTestimonials } = await import("@/lib/notion-testimonials");
      const [t] = await getTestimonials();
      expect(t.rating).toBeUndefined();
    });

    it("omits avatar when url is null", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeTestimonialPage({
          properties: { ...makeTestimonialPage().properties, Avatar: { url: null } },
        }),
      ]);

      const { getTestimonials } = await import("@/lib/notion-testimonials");
      const [t] = await getTestimonials();
      expect(t.avatar).toBeUndefined();
    });

    it("defaults name to Anonymous when title is empty", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeTestimonialPage({
          properties: { ...makeTestimonialPage().properties, Name: { title: [] } },
        }),
      ]);

      const { getTestimonials } = await import("@/lib/notion-testimonials");
      const [t] = await getTestimonials();
      expect(t.name).toBe("Anonymous");
    });
  });

  describe("getFeaturedTestimonials", () => {
    it("returns only featured testimonials", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeTestimonialPage(),
        makeTestimonialPage({
          id: "t-2",
          properties: { ...makeTestimonialPage().properties, Featured: { checkbox: false } },
        }),
      ]);

      const { getFeaturedTestimonials } = await import("@/lib/notion-testimonials");
      const result = await getFeaturedTestimonials();

      expect(result).toHaveLength(1);
      expect(result[0].featured).toBe(true);
    });

    it("returns empty array when none are featured", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeTestimonialPage({
          properties: { ...makeTestimonialPage().properties, Featured: { checkbox: false } },
        }),
      ]);

      const { getFeaturedTestimonials } = await import("@/lib/notion-testimonials");
      const result = await getFeaturedTestimonials();

      expect(result).toHaveLength(0);
    });
  });

  describe("staticTestimonials", () => {
    it("exports a non-empty static fallback array", async () => {
      const { staticTestimonials } = await import("@/lib/notion-testimonials");
      expect(staticTestimonials.length).toBeGreaterThan(0);
      expect(staticTestimonials[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        quote: expect.any(String),
        featured: expect.any(Boolean),
      });
    });
  });

  describe("getAllTestimonialsAdmin", () => {
    it("returns static fallback when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();
      const { getAllTestimonialsAdmin, staticTestimonials } =
        await import("@/lib/notion-testimonials");
      const result = await getAllTestimonialsAdmin();
      expect(result).toEqual(staticTestimonials);
      expect(mockNotionFetchAll).not.toHaveBeenCalled();
    });

    it("lists every page sorted by Order (no Published filter)", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeTestimonialPage(),
        makeTestimonialPage({
          id: "t-2",
          properties: { ...makeTestimonialPage().properties, Published: { checkbox: false } },
        }),
      ]);
      const { getAllTestimonialsAdmin } = await import("@/lib/notion-testimonials");
      const result = await getAllTestimonialsAdmin();
      expect(result).toHaveLength(2);
      const [, body] = mockNotionFetchAll.mock.calls[0];
      expect(body.filter).toBeUndefined();
      expect(body.sorts).toEqual([{ property: "Order", direction: "ascending" }]);
    });

    it("returns empty array on fetch error", async () => {
      mockNotionFetchAll.mockRejectedValueOnce(new Error("boom"));
      const { getAllTestimonialsAdmin } = await import("@/lib/notion-testimonials");
      expect(await getAllTestimonialsAdmin()).toEqual([]);
    });
  });

  describe("createTestimonial", () => {
    it("maps input to Notion props and invalidates cache on success", async () => {
      mockCreatePage.mockResolvedValueOnce("new-page-id");
      const { createTestimonial } = await import("@/lib/notion-testimonials");
      const { invalidateCache } = await import("@/lib/notion-cache");
      const id = await createTestimonial({
        name: "Maria K.",
        company: "Acme",
        role: "CEO",
        quote: "Great work",
        avatar: "https://x/a.png",
        service: "Audit",
        rating: 4,
        featured: true,
        published: true,
        order: 2,
      });
      expect(id).toBe("new-page-id");
      const [dbId, props] = mockCreatePage.mock.calls[0];
      expect(dbId).toBe("test-testimonials-db");
      expect(props.Name).toEqual({ title: [{ text: { content: "Maria K." } }] });
      expect(props.Rating).toEqual({ number: 4 });
      expect(props.Avatar).toEqual({ url: "https://x/a.png" });
      expect(props.Featured).toEqual({ checkbox: true });
      expect(invalidateCache).toHaveBeenCalledWith("testimonials");
    });

    it("omits optional props when absent and does not invalidate on null id", async () => {
      mockCreatePage.mockResolvedValueOnce(null);
      const { createTestimonial } = await import("@/lib/notion-testimonials");
      const { invalidateCache } = await import("@/lib/notion-cache");
      const id = await createTestimonial({ name: "No Extras", quote: "ok" });
      expect(id).toBeNull();
      const [, props] = mockCreatePage.mock.calls[0];
      expect(props.Avatar).toBeUndefined();
      expect(props.Service).toBeUndefined();
      expect(props.Rating).toBeUndefined();
      expect(props.Featured).toEqual({ checkbox: false });
      expect(invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe("updateTestimonial", () => {
    it("builds a partial prop set and invalidates cache when update succeeds", async () => {
      mockUpdatePage.mockResolvedValueOnce(true);
      const { updateTestimonial } = await import("@/lib/notion-testimonials");
      const { invalidateCache } = await import("@/lib/notion-cache");
      const ok = await updateTestimonial("page-7", { quote: "Updated", rating: 5 });
      expect(ok).toBe(true);
      const [pageId, props] = mockUpdatePage.mock.calls[0];
      expect(pageId).toBe("page-7");
      expect(props.Quote).toEqual({ rich_text: [{ text: { content: "Updated" } }] });
      expect(props.Rating).toEqual({ number: 5 });
      expect(props.Name).toBeUndefined();
      expect(invalidateCache).toHaveBeenCalledWith("testimonials");
    });

    it("clears avatar/service via null when explicitly set empty", async () => {
      mockUpdatePage.mockResolvedValueOnce(true);
      const { updateTestimonial } = await import("@/lib/notion-testimonials");
      await updateTestimonial("page-8", { avatar: "", service: "" });
      const [, props] = mockUpdatePage.mock.calls[0];
      expect(props.Avatar).toEqual({ url: null });
      expect(props.Service).toEqual({ select: null });
    });

    it("does not invalidate cache when update fails", async () => {
      mockUpdatePage.mockResolvedValueOnce(false);
      const { updateTestimonial } = await import("@/lib/notion-testimonials");
      const { invalidateCache } = await import("@/lib/notion-cache");
      const ok = await updateTestimonial("page-9", { name: "X" });
      expect(ok).toBe(false);
      expect(invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe("deleteTestimonial", () => {
    it("archives the page and invalidates cache on success", async () => {
      mockArchivePage.mockResolvedValueOnce(true);
      const { deleteTestimonial } = await import("@/lib/notion-testimonials");
      const { invalidateCache } = await import("@/lib/notion-cache");
      const ok = await deleteTestimonial("page-del");
      expect(ok).toBe(true);
      expect(mockArchivePage).toHaveBeenCalledWith("page-del");
      expect(invalidateCache).toHaveBeenCalledWith("testimonials");
    });

    it("returns false and skips cache invalidation when archive fails", async () => {
      mockArchivePage.mockResolvedValueOnce(false);
      const { deleteTestimonial } = await import("@/lib/notion-testimonials");
      const { invalidateCache } = await import("@/lib/notion-cache");
      const ok = await deleteTestimonial("page-x");
      expect(ok).toBe(false);
      expect(invalidateCache).not.toHaveBeenCalled();
    });
  });
});
