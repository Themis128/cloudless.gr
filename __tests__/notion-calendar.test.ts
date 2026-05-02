import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resetIntegrationCache,
  resetIntegrationCacheAsync,
  IntegrationNotConfiguredError,
} from "@/lib/integrations";

const mockNotionFetch = vi.fn();

vi.mock("@/lib/notion", () => ({
  notionFetch: (...args: unknown[]) => mockNotionFetch(...args),
}));

function makeCalPage(overrides: Record<string, unknown> = {}) {
  return {
    id: "notion-page-1",
    properties: {
      Name: { title: [{ plain_text: "Weekly Meta Post" }] },
      CalID: { rich_text: [{ plain_text: "cal_1234_abc" }] },
      Type: { select: { name: "social_post" } },
      Platform: { select: { name: "meta" } },
      Date: { date: { start: "2026-05-10", end: null } },
      Status: { select: { name: "draft" } },
      URL: { url: null },
      Notes: { rich_text: [] },
    },
    ...overrides,
  };
}

describe("notion-calendar.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
    resetIntegrationCacheAsync();
    process.env.NOTION_CALENDAR_DB_ID = "calendar-db-123";
    process.env.NOTION_API_KEY = "secret_test_key_12345";
  });

  // ---------------------------------------------------------------------------
  // notionGetCalendarItems
  // ---------------------------------------------------------------------------

  describe("notionGetCalendarItems", () => {
    it("queries the calendar DB and returns mapped items", async () => {
      mockNotionFetch.mockResolvedValueOnce({ results: [makeCalPage()] });

      const { notionGetCalendarItems } = await import("@/lib/notion-calendar");
      const items = await notionGetCalendarItems();

      expect(items).toHaveLength(1);
      expect(items![0].id).toBe("cal_1234_abc");
      expect(items![0].title).toBe("Weekly Meta Post");
      expect(items![0].type).toBe("social_post");
      expect(items![0].platform).toBe("meta");
      expect(items![0].date).toBe("2026-05-10");
      expect(items![0].status).toBe("draft");
      expect(mockNotionFetch).toHaveBeenCalledWith(
        `/databases/calendar-db-123/query`,
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws when NOTION_CALENDAR_DB_ID not configured", async () => {
      process.env.NOTION_CALENDAR_DB_ID = "";
      resetIntegrationCache();
      resetIntegrationCacheAsync();

      const { notionGetCalendarItems } = await import("@/lib/notion-calendar");
      await expect(notionGetCalendarItems()).rejects.toBeInstanceOf(
        IntegrationNotConfiguredError,
      );
      expect(mockNotionFetch).not.toHaveBeenCalled();
    });

    it("throws when NOTION_API_KEY not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();
      resetIntegrationCacheAsync();

      const { notionGetCalendarItems } = await import("@/lib/notion-calendar");
      await expect(notionGetCalendarItems()).rejects.toBeInstanceOf(
        IntegrationNotConfiguredError,
      );
      expect(mockNotionFetch).not.toHaveBeenCalled();
    });

    it("returns null on API error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("Notion API 502"));

      const { notionGetCalendarItems } = await import("@/lib/notion-calendar");
      const items = await notionGetCalendarItems();

      expect(items).toBeNull();
    });

    it("sends single date filter when only from is provided", async () => {
      mockNotionFetch.mockResolvedValueOnce({ results: [] });

      const { notionGetCalendarItems } = await import("@/lib/notion-calendar");
      await notionGetCalendarItems("2026-05-01");

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.filter).toEqual({ property: "Date", date: { on_or_after: "2026-05-01" } });
    });

    it("sends AND filter when both from and to are provided", async () => {
      mockNotionFetch.mockResolvedValueOnce({ results: [] });

      const { notionGetCalendarItems } = await import("@/lib/notion-calendar");
      await notionGetCalendarItems("2026-05-01", "2026-05-31");

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.filter).toEqual({
        and: [
          { property: "Date", date: { on_or_after: "2026-05-01" } },
          { property: "Date", date: { on_or_before: "2026-05-31" } },
        ],
      });
    });

    it("maps endDate when present", async () => {
      mockNotionFetch.mockResolvedValueOnce({
        results: [
          makeCalPage({
            properties: {
              ...makeCalPage().properties,
              Date: { date: { start: "2026-05-10", end: "2026-05-12" } },
            },
          }),
        ],
      });

      const { notionGetCalendarItems } = await import("@/lib/notion-calendar");
      const items = await notionGetCalendarItems();
      expect(items![0].endDate).toBe("2026-05-12");
    });

    it("uses Notion page id when CalID is empty", async () => {
      mockNotionFetch.mockResolvedValueOnce({
        results: [
          makeCalPage({
            id: "notion-fallback-id",
            properties: {
              ...makeCalPage().properties,
              CalID: { rich_text: [] },
            },
          }),
        ],
      });

      const { notionGetCalendarItems } = await import("@/lib/notion-calendar");
      const items = await notionGetCalendarItems();
      expect(items![0].id).toBe("notion-fallback-id");
    });
  });

  // ---------------------------------------------------------------------------
  // notionCreateCalendarItem
  // ---------------------------------------------------------------------------

  describe("notionCreateCalendarItem", () => {
    it("creates a page and returns its Notion ID", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "new-notion-page" });

      const { notionCreateCalendarItem } = await import("@/lib/notion-calendar");
      const pageId = await notionCreateCalendarItem({
        id: "cal_999_xyz",
        title: "LinkedIn Campaign",
        type: "ad_campaign",
        platform: "linkedin",
        date: "2026-06-01",
        status: "scheduled",
      });

      expect(pageId).toBe("new-notion-page");
      expect(mockNotionFetch).toHaveBeenCalledWith(
        "/pages",
        expect.objectContaining({ method: "POST" }),
      );

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.parent.database_id).toBe("calendar-db-123");
      expect(body.properties.Name.title[0].text.content).toBe("LinkedIn Campaign");
      expect(body.properties.CalID.rich_text[0].text.content).toBe("cal_999_xyz");
      expect(body.properties.Type.select.name).toBe("ad_campaign");
      expect(body.properties.Platform.select.name).toBe("linkedin");
      expect(body.properties.Date.date.start).toBe("2026-06-01");
      expect(body.properties.Status.select.name).toBe("scheduled");
    });

    it("includes URL and Notes when provided", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "p1" });

      const { notionCreateCalendarItem } = await import("@/lib/notion-calendar");
      await notionCreateCalendarItem({
        id: "cal_1",
        title: "Post",
        type: "social_post",
        platform: "x",
        date: "2026-06-01",
        status: "draft",
        url: "https://x.com/cloudless",
        notes: "Remember to include hashtags",
      });

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.URL.url).toBe("https://x.com/cloudless");
      expect(body.properties.Notes.rich_text[0].text.content).toBe("Remember to include hashtags");
    });

    it("includes endDate in date range when provided", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "p1" });

      const { notionCreateCalendarItem } = await import("@/lib/notion-calendar");
      await notionCreateCalendarItem({
        id: "cal_1",
        title: "Campaign",
        type: "ad_campaign",
        platform: "google",
        date: "2026-06-01",
        endDate: "2026-06-30",
        status: "scheduled",
      });

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Date.date.end).toBe("2026-06-30");
    });

    it("throws when not configured", async () => {
      process.env.NOTION_CALENDAR_DB_ID = "";
      resetIntegrationCache();
      resetIntegrationCacheAsync();

      const { notionCreateCalendarItem } = await import("@/lib/notion-calendar");
      await expect(
        notionCreateCalendarItem({
          id: "cal_1",
          title: "T",
          type: "social_post",
          platform: "x",
          date: "2026-06-01",
          status: "draft",
        }),
      ).rejects.toBeInstanceOf(IntegrationNotConfiguredError);
      expect(mockNotionFetch).not.toHaveBeenCalled();
    });

    it("returns null on API error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("fail"));

      const { notionCreateCalendarItem } = await import("@/lib/notion-calendar");
      const result = await notionCreateCalendarItem({
        id: "cal_1",
        title: "T",
        type: "social_post",
        platform: "x",
        date: "2026-06-01",
        status: "draft",
      });

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // notionUpdateCalendarItem
  // ---------------------------------------------------------------------------

  describe("notionUpdateCalendarItem", () => {
    it("finds page by CalID and patches properties", async () => {
      mockNotionFetch
        .mockResolvedValueOnce({ results: [{ id: "page-to-patch" }] })
        .mockResolvedValueOnce({});

      const { notionUpdateCalendarItem } = await import("@/lib/notion-calendar");
      const ok = await notionUpdateCalendarItem({
        id: "cal_1234_abc",
        title: "Updated Title",
        type: "social_post",
        platform: "linkedin",
        date: "2026-05-15",
        status: "published",
      });

      expect(ok).toBe(true);
      expect(mockNotionFetch).toHaveBeenCalledTimes(2);
      // First call: search
      const searchBody = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(searchBody.filter).toEqual({ property: "CalID", rich_text: { equals: "cal_1234_abc" } });
      // Second call: patch
      expect(mockNotionFetch.mock.calls[1][0]).toBe("/pages/page-to-patch");
      const patchBody = JSON.parse(mockNotionFetch.mock.calls[1][1].body);
      expect(patchBody.properties.Name.title[0].text.content).toBe("Updated Title");
      expect(patchBody.properties.Status.select.name).toBe("published");
    });

    it("returns false when page not found", async () => {
      mockNotionFetch.mockResolvedValueOnce({ results: [] });

      const { notionUpdateCalendarItem } = await import("@/lib/notion-calendar");
      const ok = await notionUpdateCalendarItem({
        id: "cal_ghost",
        title: "Ghost",
        type: "social_post",
        platform: "x",
        date: "2026-05-01",
        status: "draft",
      });

      expect(ok).toBe(false);
    });

    it("throws when not configured", async () => {
      process.env.NOTION_CALENDAR_DB_ID = "";
      resetIntegrationCache();
      resetIntegrationCacheAsync();

      const { notionUpdateCalendarItem } = await import("@/lib/notion-calendar");
      await expect(
        notionUpdateCalendarItem({
          id: "cal_1",
          title: "T",
          type: "social_post",
          platform: "x",
          date: "2026-06-01",
          status: "draft",
        }),
      ).rejects.toBeInstanceOf(IntegrationNotConfiguredError);
      expect(mockNotionFetch).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // notionDeleteCalendarItem
  // ---------------------------------------------------------------------------

  describe("notionDeleteCalendarItem", () => {
    it("finds page by CalID and archives it", async () => {
      mockNotionFetch
        .mockResolvedValueOnce({ results: [{ id: "page-to-archive" }] })
        .mockResolvedValueOnce({});

      const { notionDeleteCalendarItem } = await import("@/lib/notion-calendar");
      const ok = await notionDeleteCalendarItem("cal_1234_abc");

      expect(ok).toBe(true);
      const patchCall = mockNotionFetch.mock.calls[1];
      expect(patchCall[0]).toBe("/pages/page-to-archive");
      expect(JSON.parse(patchCall[1].body)).toEqual({ archived: true });
    });

    it("returns false when page not found", async () => {
      mockNotionFetch.mockResolvedValueOnce({ results: [] });

      const { notionDeleteCalendarItem } = await import("@/lib/notion-calendar");
      const ok = await notionDeleteCalendarItem("cal_ghost");

      expect(ok).toBe(false);
    });

    it("throws when not configured", async () => {
      process.env.NOTION_CALENDAR_DB_ID = "";
      resetIntegrationCache();
      resetIntegrationCacheAsync();

      const { notionDeleteCalendarItem } = await import("@/lib/notion-calendar");
      await expect(
        notionDeleteCalendarItem("cal_1"),
      ).rejects.toBeInstanceOf(IntegrationNotConfiguredError);
      expect(mockNotionFetch).not.toHaveBeenCalled();
    });

    it("returns false on API error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("fail"));

      const { notionDeleteCalendarItem } = await import("@/lib/notion-calendar");
      const ok = await notionDeleteCalendarItem("cal_err");

      expect(ok).toBe(false);
    });
  });
});
