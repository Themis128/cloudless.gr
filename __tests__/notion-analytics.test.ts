import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetIntegrationCache } from "@/lib/integrations";

const mockNotionFetch = vi.fn();
const mockNotionFetchAll = vi.fn();

vi.mock("@/lib/notion", () => ({
  notionFetch: (...args: unknown[]) => mockNotionFetch(...args),
  notionFetchAll: (...args: unknown[]) => mockNotionFetchAll(...args),
  extractText: (rt: { plain_text: string }[] | undefined) =>
    (rt ?? []).map((t) => t.plain_text).join(""),
}));

function makeEventPage(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    created_time: "2026-04-10T12:00:00Z",
    properties: {
      Event: { title: [{ plain_text: "Page View: /blog" }] },
      Type: { select: { name: "page_view" } },
      Page: { rich_text: [{ plain_text: "/blog" }] },
      Source: { rich_text: [{ plain_text: "google" }] },
      Count: { number: 1 },
      Date: { date: { start: "2026-04-10" } },
      Country: { rich_text: [{ plain_text: "GR" }] },
      Metadata: { rich_text: [] },
    },
    ...overrides,
  };
}

describe("notion-analytics.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
  });

  describe("trackEvent", () => {
    it("creates an analytics event page", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "evt-new" });

      const { trackEvent } = await import("@/lib/notion-analytics");
      const id = await trackEvent({
        event: "Form: Contact",
        type: "form_submit",
        page: "/contact",
        source: "direct",
      });

      expect(id).toBe("evt-new");
      expect(mockNotionFetch).toHaveBeenCalledWith(
        "/pages",
        expect.objectContaining({ method: "POST" }),
      );

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.parent.database_id).toBe("analytics-db-123");
      expect(body.properties.Event.title[0].text.content).toBe("Form: Contact");
      expect(body.properties.Type.select.name).toBe("form_submit");
    });

    it("returns null when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();

      const { trackEvent } = await import("@/lib/notion-analytics");
      const id = await trackEvent({ event: "test", type: "page_view" });

      expect(id).toBeNull();
      expect(mockNotionFetch).not.toHaveBeenCalled();
    });

    it("returns null on error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("fail"));

      const { trackEvent } = await import("@/lib/notion-analytics");
      const id = await trackEvent({ event: "test", type: "error" });

      expect(id).toBeNull();
    });

    it("truncates long event names to 200 chars", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "evt" });

      const { trackEvent } = await import("@/lib/notion-analytics");
      await trackEvent({ event: "x".repeat(300), type: "page_view" });

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Event.title[0].text.content.length).toBe(200);
    });

    it("serializes metadata as JSON", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "evt" });

      const { trackEvent } = await import("@/lib/notion-analytics");
      await trackEvent({
        event: "Error",
        type: "error",
        metadata: { code: 500, message: "Internal error" },
      });

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      const metaContent = body.properties.Metadata.rich_text[0].text.content;
      expect(JSON.parse(metaContent)).toEqual({ code: 500, message: "Internal error" });
    });
  });

  describe("trackFormSubmission", () => {
    it("creates a form_submit event", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "evt" });

      const { trackFormSubmission } = await import("@/lib/notion-analytics");
      await trackFormSubmission("Contact", "google");

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Event.title[0].text.content).toBe("Form: Contact");
      expect(body.properties.Type.select.name).toBe("form_submit");
    });
  });

  describe("trackBlogView", () => {
    it("creates a blog_view event", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "evt" });

      const { trackBlogView } = await import("@/lib/notion-analytics");
      await trackBlogView("my-post", "twitter");

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Event.title[0].text.content).toBe("Blog: my-post");
      expect(body.properties.Page.rich_text[0].text.content).toBe("/blog/my-post");
    });
  });

  describe("getRecentEvents", () => {
    it("returns mapped events", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeEventPage()]);

      const { getRecentEvents } = await import("@/lib/notion-analytics");
      const events = await getRecentEvents();

      expect(events).toHaveLength(1);
      expect(events[0].event).toBe("Page View: /blog");
      expect(events[0].type).toBe("page_view");
      expect(events[0].page).toBe("/blog");
    });

    it("applies type filter", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { getRecentEvents } = await import("@/lib/notion-analytics");
      await getRecentEvents("error");

      const callBody = mockNotionFetchAll.mock.calls[0][1];
      expect(callBody.filter).toEqual({
        property: "Type",
        select: { equals: "error" },
      });
    });

    it("returns empty when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();

      const { getRecentEvents } = await import("@/lib/notion-analytics");
      expect(await getRecentEvents()).toEqual([]);
    });
  });

  describe("getAnalyticsSummary", () => {
    it("aggregates event data", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeEventPage(),
        makeEventPage({
          id: "evt-2",
          properties: {
            ...makeEventPage().properties,
            Type: { select: { name: "form_submit" } },
            Page: { rich_text: [{ plain_text: "/contact" }] },
            Count: { number: 3 },
          },
        }),
        makeEventPage({
          id: "evt-3",
          properties: {
            ...makeEventPage().properties,
            Count: { number: 5 },
          },
        }),
      ]);

      const { getAnalyticsSummary } = await import("@/lib/notion-analytics");
      const summary = await getAnalyticsSummary(7);

      expect(summary.totalEvents).toBe(9); // 1 + 3 + 5
      expect(summary.byType.page_view).toBe(6); // 1 + 5
      expect(summary.byType.form_submit).toBe(3);
      expect(summary.topPages.length).toBeGreaterThan(0);
      expect(summary.topSources.length).toBeGreaterThan(0);
    });

    it("returns recentEvents limited to 20", async () => {
      const manyEvents = Array.from({ length: 25 }, (_, i) =>
        makeEventPage({ id: `evt-${i}` }),
      );
      mockNotionFetchAll.mockResolvedValueOnce(manyEvents);

      const { getAnalyticsSummary } = await import("@/lib/notion-analytics");
      const summary = await getAnalyticsSummary(7);

      expect(summary.recentEvents.length).toBeLessThanOrEqual(20);
    });

    it("returns empty summary when no events", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { getAnalyticsSummary } = await import("@/lib/notion-analytics");
      const summary = await getAnalyticsSummary(7);

      expect(summary.totalEvents).toBe(0);
      expect(summary.byType).toEqual({});
      expect(summary.topPages).toEqual([]);
      expect(summary.topSources).toEqual([]);
    });
  });

  describe("getEventsByDateRange", () => {
    it("filters by date range", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeEventPage()]);

      const { getEventsByDateRange } = await import("@/lib/notion-analytics");
      const events = await getEventsByDateRange("2026-04-01", "2026-04-10");

      expect(events).toHaveLength(1);
      const callBody = mockNotionFetchAll.mock.calls[0][1];
      expect(callBody.filter.and).toEqual([
        { property: "Date", date: { on_or_after: "2026-04-01" } },
        { property: "Date", date: { on_or_before: "2026-04-10" } },
      ]);
    });

    it("returns empty when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();

      const { getEventsByDateRange } = await import("@/lib/notion-analytics");
      expect(await getEventsByDateRange("2026-04-01", "2026-04-10")).toEqual([]);
    });

    it("returns empty on error", async () => {
      mockNotionFetchAll.mockRejectedValueOnce(new Error("fail"));

      const { getEventsByDateRange } = await import("@/lib/notion-analytics");
      expect(await getEventsByDateRange("2026-04-01", "2026-04-10")).toEqual([]);
    });
  });

  describe("createWeeklyRollup", () => {
    it("creates a weekly_rollup event with summary data", async () => {
      // First call: getEventsByDateRange inside getAnalyticsSummary
      mockNotionFetchAll.mockResolvedValueOnce([
        makeEventPage(),
        makeEventPage({
          id: "evt-2",
          properties: {
            ...makeEventPage().properties,
            Count: { number: 4 },
          },
        }),
      ]);
      // Second call: trackEvent creates a page
      mockNotionFetch.mockResolvedValueOnce({ id: "rollup-1" });

      const { createWeeklyRollup } = await import("@/lib/notion-analytics");
      const id = await createWeeklyRollup();

      expect(id).toBe("rollup-1");
      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Type.select.name).toBe("weekly_rollup");
      expect(body.properties.Count.number).toBe(5); // 1 + 4
      expect(body.properties.Event.title[0].text.content).toContain("Weekly Rollup");
    });
  });

  describe("trackEvent edge cases", () => {
    it("omits optional fields when not provided", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "evt" });

      const { trackEvent } = await import("@/lib/notion-analytics");
      await trackEvent({ event: "Simple", type: "page_view" });

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Page).toBeUndefined();
      expect(body.properties.Source).toBeUndefined();
      expect(body.properties.Country).toBeUndefined();
      expect(body.properties.Metadata).toBeUndefined();
      expect(body.properties.Count.number).toBe(1); // default count
    });

    it("includes all optional fields when provided", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "evt" });

      const { trackEvent } = await import("@/lib/notion-analytics");
      await trackEvent({
        event: "Full Event",
        type: "page_view",
        page: "/about",
        source: "google",
        count: 5,
        country: "US",
        metadata: { key: "value" },
      });

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Page.rich_text[0].text.content).toBe("/about");
      expect(body.properties.Source.rich_text[0].text.content).toBe("google");
      expect(body.properties.Count.number).toBe(5);
      expect(body.properties.Country.rich_text[0].text.content).toBe("US");
      expect(body.properties.Metadata.rich_text[0].text.content).toBe('{"key":"value"}');
    });
  });

  describe("archiveOldEvents", () => {
    it("archives old page_view, blog_view, doc_view events", async () => {
      // Three queries — one per archivable type
      mockNotionFetchAll
        .mockResolvedValueOnce([{ id: "pv-1" }, { id: "pv-2" }]) // page_view
        .mockResolvedValueOnce([{ id: "bv-1" }])                  // blog_view
        .mockResolvedValueOnce([]);                                // doc_view

      // PATCH calls for each page (pv-1, pv-2, bv-1)
      mockNotionFetch
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const { archiveOldEvents } = await import("@/lib/notion-analytics");
      const result = await archiveOldEvents(30);

      expect(result).toEqual({ archived: 3, errors: 0 });

      // Verify each archive PATCH
      expect(mockNotionFetch).toHaveBeenCalledTimes(3);
      expect(mockNotionFetch).toHaveBeenCalledWith(
        "/pages/pv-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ archived: true }),
        }),
      );

      // Verify query filters include correct types
      const queryTypes = mockNotionFetchAll.mock.calls.map(
        (c: any) => c[1].filter.and[0].select.equals,
      );
      expect(queryTypes).toEqual(["page_view", "blog_view", "doc_view"]);
    });

    it("counts errors when individual archive fails", async () => {
      mockNotionFetchAll
        .mockResolvedValueOnce([{ id: "pv-1" }, { id: "pv-2" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockNotionFetch
        .mockResolvedValueOnce({})           // pv-1 succeeds
        .mockRejectedValueOnce(new Error("fail")); // pv-2 fails

      const { archiveOldEvents } = await import("@/lib/notion-analytics");
      const result = await archiveOldEvents(30);

      expect(result).toEqual({ archived: 1, errors: 1 });
    });

    it("counts error when query for a type fails", async () => {
      mockNotionFetchAll
        .mockRejectedValueOnce(new Error("query fail")) // page_view query fails
        .mockResolvedValueOnce([])                       // blog_view
        .mockResolvedValueOnce([]);                      // doc_view

      const { archiveOldEvents } = await import("@/lib/notion-analytics");
      const result = await archiveOldEvents(30);

      expect(result).toEqual({ archived: 0, errors: 1 });
    });

    it("returns zeros when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();

      const { archiveOldEvents } = await import("@/lib/notion-analytics");
      const result = await archiveOldEvents();

      expect(result).toEqual({ archived: 0, errors: 0 });
      expect(mockNotionFetchAll).not.toHaveBeenCalled();
    });

    it("uses custom daysToKeep for cutoff date", async () => {
      mockNotionFetchAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const { archiveOldEvents } = await import("@/lib/notion-analytics");
      await archiveOldEvents(7);

      // Verify the date filter uses 7 days ago
      const dateFilter = mockNotionFetchAll.mock.calls[0][1].filter.and[1];
      expect(dateFilter.property).toBe("Date");
      expect(dateFilter.date.before).toBeDefined();

      // The cutoff should be ~7 days ago
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      expect(dateFilter.date.before).toBe(cutoff.toISOString().split("T")[0]);
    });
  });

  describe("mapEvent edge cases", () => {
    it("defaults type to page_view when missing", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeEventPage({
          properties: {
            ...makeEventPage().properties,
            Type: {},
          },
        }),
      ]);

      const { getRecentEvents } = await import("@/lib/notion-analytics");
      const events = await getRecentEvents();

      expect(events[0].type).toBe("page_view");
    });

    it("defaults count to 1 when missing", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeEventPage({
          properties: {
            ...makeEventPage().properties,
            Count: {},
          },
        }),
      ]);

      const { getRecentEvents } = await import("@/lib/notion-analytics");
      const events = await getRecentEvents();

      expect(events[0].count).toBe(1);
    });
  });
});
