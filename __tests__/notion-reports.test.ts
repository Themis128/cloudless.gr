import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetIntegrationCache, resetIntegrationCacheAsync } from "@/lib/integrations";

const mockNotionFetch = vi.fn();

vi.mock("@/lib/notion", () => ({
  notionFetch: (...args: unknown[]) => mockNotionFetch(...args),
}));

function makeReportPage(overrides: Record<string, unknown> = {}) {
  return {
    id: "notion-page-1",
    properties: {
      Name: { title: [{ plain_text: "Acme Corp April Report" }] },
      ReportID: { rich_text: [{ plain_text: "report_1234_abc" }] },
      Status: { select: { name: "ready" } },
      DateStart: { date: { start: "2026-04-01" } },
      DateEnd: { rich_text: [{ plain_text: "2026-04-30" }] },
      Sections: { rich_text: [{ plain_text: "[]" }] },
      CreatedAt: { date: { start: "2026-04-01T10:00:00.000Z" } },
    },
    ...overrides,
  };
}

describe("notion-reports.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
    resetIntegrationCacheAsync();
    process.env.NOTION_REPORTS_DB_ID = "reports-db-123";
    process.env.NOTION_API_KEY = "secret_test_key_12345";
  });

  // ---------------------------------------------------------------------------
  // notionListReports
  // ---------------------------------------------------------------------------

  describe("notionListReports", () => {
    it("queries the reports DB and returns mapped items", async () => {
      mockNotionFetch.mockResolvedValueOnce({ results: [makeReportPage()] });

      const { notionListReports } = await import("@/lib/notion-reports");
      const reports = await notionListReports();

      expect(reports).toHaveLength(1);
      expect(reports![0].id).toBe("report_1234_abc");
      expect(reports![0].clientName).toBe("Acme Corp April Report");
      expect(reports![0].status).toBe("ready");
      expect(reports![0].dateRange.start).toBe("2026-04-01");
      expect(reports![0].dateRange.end).toBe("2026-04-30");
      expect(mockNotionFetch).toHaveBeenCalledWith(
        `/databases/reports-db-123/query`,
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("returns null when NOTION_REPORTS_DB_ID not configured", async () => {
      process.env.NOTION_REPORTS_DB_ID = "";
      resetIntegrationCache();
      resetIntegrationCacheAsync();

      const { notionListReports } = await import("@/lib/notion-reports");
      const reports = await notionListReports();

      expect(reports).toBeNull();
      expect(mockNotionFetch).not.toHaveBeenCalled();
    });

    it("returns null when NOTION_API_KEY not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();
      resetIntegrationCacheAsync();

      const { notionListReports } = await import("@/lib/notion-reports");
      const reports = await notionListReports();

      expect(reports).toBeNull();
      expect(mockNotionFetch).not.toHaveBeenCalled();
    });

    it("returns null on API error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("Notion API 502"));

      const { notionListReports } = await import("@/lib/notion-reports");
      const reports = await notionListReports();

      expect(reports).toBeNull();
    });

    it("sends descending sort by CreatedAt", async () => {
      mockNotionFetch.mockResolvedValueOnce({ results: [] });

      const { notionListReports } = await import("@/lib/notion-reports");
      await notionListReports();

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.sorts).toEqual([{ property: "CreatedAt", direction: "descending" }]);
    });

    it("uses Notion page id when ReportID is empty", async () => {
      mockNotionFetch.mockResolvedValueOnce({
        results: [
          makeReportPage({
            id: "notion-fallback-id",
            properties: {
              ...makeReportPage().properties,
              ReportID: { rich_text: [] },
            },
          }),
        ],
      });

      const { notionListReports } = await import("@/lib/notion-reports");
      const reports = await notionListReports();
      expect(reports![0].id).toBe("notion-fallback-id");
    });

    it("parses sections JSON from Sections property", async () => {
      const sections = [{ id: "s1", title: "Pipeline", data: { deals: 10 } }];
      mockNotionFetch.mockResolvedValueOnce({
        results: [
          makeReportPage({
            properties: {
              ...makeReportPage().properties,
              Sections: { rich_text: [{ plain_text: JSON.stringify(sections) }] },
            },
          }),
        ],
      });

      const { notionListReports } = await import("@/lib/notion-reports");
      const reports = await notionListReports();
      expect(reports![0].sections).toEqual(sections);
    });
  });

  // ---------------------------------------------------------------------------
  // notionGetReport
  // ---------------------------------------------------------------------------

  describe("notionGetReport", () => {
    it("queries by ReportID filter and returns mapped report", async () => {
      mockNotionFetch.mockResolvedValueOnce({ results: [makeReportPage()] });

      const { notionGetReport } = await import("@/lib/notion-reports");
      const report = await notionGetReport("report_1234_abc");

      expect(report).not.toBeNull();
      expect(report!.id).toBe("report_1234_abc");
      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.filter).toEqual({ property: "ReportID", rich_text: { equals: "report_1234_abc" } });
      expect(body.page_size).toBe(1);
    });

    it("returns null when no matching page found", async () => {
      mockNotionFetch.mockResolvedValueOnce({ results: [] });

      const { notionGetReport } = await import("@/lib/notion-reports");
      const report = await notionGetReport("report_ghost");

      expect(report).toBeNull();
    });

    it("returns null when not configured", async () => {
      process.env.NOTION_REPORTS_DB_ID = "";
      resetIntegrationCache();
      resetIntegrationCacheAsync();

      const { notionGetReport } = await import("@/lib/notion-reports");
      const report = await notionGetReport("report_1");

      expect(report).toBeNull();
      expect(mockNotionFetch).not.toHaveBeenCalled();
    });

    it("returns null on API error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("fail"));

      const { notionGetReport } = await import("@/lib/notion-reports");
      const report = await notionGetReport("report_1");

      expect(report).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // notionCreateReport
  // ---------------------------------------------------------------------------

  describe("notionCreateReport", () => {
    it("creates a page and returns its Notion ID", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "new-notion-page" });

      const { notionCreateReport } = await import("@/lib/notion-reports");
      const pageId = await notionCreateReport({
        id: "report_999_xyz",
        clientName: "Big Client",
        status: "generating",
        dateRange: { start: "2026-04-01", end: "2026-04-30" },
        sections: [],
        createdAt: "2026-04-01T00:00:00.000Z",
      });

      expect(pageId).toBe("new-notion-page");
      expect(mockNotionFetch).toHaveBeenCalledWith(
        "/pages",
        expect.objectContaining({ method: "POST" }),
      );

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.parent.database_id).toBe("reports-db-123");
      expect(body.properties.Name.title[0].text.content).toBe("Big Client");
      expect(body.properties.ReportID.rich_text[0].text.content).toBe("report_999_xyz");
      expect(body.properties.Status.select.name).toBe("generating");
      expect(body.properties.DateStart.date.start).toBe("2026-04-01");
      expect(body.properties.DateEnd.rich_text[0].text.content).toBe("2026-04-30");
      expect(body.properties.CreatedAt.date.start).toBe("2026-04-01T00:00:00.000Z");
    });

    it("stores sections as JSON string", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "p1" });

      const sections = [{ id: "pipeline", title: "Pipeline", data: { deals: 5 } }];
      const { notionCreateReport } = await import("@/lib/notion-reports");
      await notionCreateReport({
        id: "report_1",
        clientName: "Client",
        status: "ready",
        dateRange: { start: "2026-04-01", end: "2026-04-30" },
        sections,
        createdAt: "2026-04-01T00:00:00.000Z",
      });

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(JSON.parse(body.properties.Sections.rich_text[0].text.content)).toEqual(sections);
    });

    it("returns null when not configured", async () => {
      process.env.NOTION_REPORTS_DB_ID = "";
      resetIntegrationCache();
      resetIntegrationCacheAsync();

      const { notionCreateReport } = await import("@/lib/notion-reports");
      const result = await notionCreateReport({
        id: "report_1",
        clientName: "T",
        status: "generating",
        dateRange: { start: "2026-04-01", end: "2026-04-30" },
        sections: [],
        createdAt: "2026-04-01T00:00:00.000Z",
      });

      expect(result).toBeNull();
      expect(mockNotionFetch).not.toHaveBeenCalled();
    });

    it("returns null on API error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("fail"));

      const { notionCreateReport } = await import("@/lib/notion-reports");
      const result = await notionCreateReport({
        id: "report_1",
        clientName: "T",
        status: "generating",
        dateRange: { start: "2026-04-01", end: "2026-04-30" },
        sections: [],
        createdAt: "2026-04-01T00:00:00.000Z",
      });

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // notionUpdateReport
  // ---------------------------------------------------------------------------

  describe("notionUpdateReport", () => {
    it("finds page by ReportID and patches status", async () => {
      mockNotionFetch
        .mockResolvedValueOnce({ results: [{ id: "page-to-patch" }] })
        .mockResolvedValueOnce({});

      const { notionUpdateReport } = await import("@/lib/notion-reports");
      const ok = await notionUpdateReport("report_1234_abc", { status: "ready" });

      expect(ok).toBe(true);
      expect(mockNotionFetch).toHaveBeenCalledTimes(2);
      const searchBody = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(searchBody.filter).toEqual({ property: "ReportID", rich_text: { equals: "report_1234_abc" } });
      expect(mockNotionFetch.mock.calls[1][0]).toBe("/pages/page-to-patch");
      const patchBody = JSON.parse(mockNotionFetch.mock.calls[1][1].body);
      expect(patchBody.properties.Status.select.name).toBe("ready");
    });

    it("patches sections when provided", async () => {
      mockNotionFetch
        .mockResolvedValueOnce({ results: [{ id: "page-to-patch" }] })
        .mockResolvedValueOnce({});

      const sections = [{ id: "email", title: "Email Stats", data: {} }];
      const { notionUpdateReport } = await import("@/lib/notion-reports");
      await notionUpdateReport("report_1", { sections });

      const patchBody = JSON.parse(mockNotionFetch.mock.calls[1][1].body);
      expect(JSON.parse(patchBody.properties.Sections.rich_text[0].text.content)).toEqual(sections);
    });

    it("returns false when page not found", async () => {
      mockNotionFetch.mockResolvedValueOnce({ results: [] });

      const { notionUpdateReport } = await import("@/lib/notion-reports");
      const ok = await notionUpdateReport("report_ghost", { status: "error" });

      expect(ok).toBe(false);
    });

    it("returns false when not configured", async () => {
      process.env.NOTION_REPORTS_DB_ID = "";
      resetIntegrationCache();
      resetIntegrationCacheAsync();

      const { notionUpdateReport } = await import("@/lib/notion-reports");
      const ok = await notionUpdateReport("report_1", { status: "ready" });

      expect(ok).toBe(false);
      expect(mockNotionFetch).not.toHaveBeenCalled();
    });

    it("returns false on API error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("fail"));

      const { notionUpdateReport } = await import("@/lib/notion-reports");
      const ok = await notionUpdateReport("report_1", { status: "ready" });

      expect(ok).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // notionDeleteReport
  // ---------------------------------------------------------------------------

  describe("notionDeleteReport", () => {
    it("finds page by ReportID and archives it", async () => {
      mockNotionFetch
        .mockResolvedValueOnce({ results: [{ id: "page-to-archive" }] })
        .mockResolvedValueOnce({});

      const { notionDeleteReport } = await import("@/lib/notion-reports");
      const ok = await notionDeleteReport("report_1234_abc");

      expect(ok).toBe(true);
      const patchCall = mockNotionFetch.mock.calls[1];
      expect(patchCall[0]).toBe("/pages/page-to-archive");
      expect(JSON.parse(patchCall[1].body)).toEqual({ archived: true });
    });

    it("returns false when page not found", async () => {
      mockNotionFetch.mockResolvedValueOnce({ results: [] });

      const { notionDeleteReport } = await import("@/lib/notion-reports");
      const ok = await notionDeleteReport("report_ghost");

      expect(ok).toBe(false);
    });

    it("returns false when not configured", async () => {
      process.env.NOTION_REPORTS_DB_ID = "";
      resetIntegrationCache();
      resetIntegrationCacheAsync();

      const { notionDeleteReport } = await import("@/lib/notion-reports");
      const ok = await notionDeleteReport("report_1");

      expect(ok).toBe(false);
      expect(mockNotionFetch).not.toHaveBeenCalled();
    });

    it("returns false on API error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("fail"));

      const { notionDeleteReport } = await import("@/lib/notion-reports");
      const ok = await notionDeleteReport("report_err");

      expect(ok).toBe(false);
    });
  });
});
