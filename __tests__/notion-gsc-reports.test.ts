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

function makeGscPage(overrides: Record<string, unknown> = {}) {
  return {
    id: "notion-gsc-1",
    properties: {
      Week: { title: [{ plain_text: "Week of 2026-06-08" }] },
      Date: { date: { start: "2026-06-08" } },
      Clicks: { number: 1234 },
      Impressions: { number: 56789 },
      "CTR %": { number: 3.5 },
      "Avg Position": { number: 12.4 },
      Keywords: { number: 87 },
      "Top Keywords": {
        rich_text: [
          {
            plain_text: JSON.stringify([
              { q: "cloud consulting", clicks: 40, ctr: 5.1 },
              { q: "aws audit", clicks: 22, ctr: 3.0 },
            ]),
          },
        ],
      },
      "Top Country": { rich_text: [{ plain_text: "GR" }] },
      "Mobile %": { number: 61.2 },
      "CTR Opportunities": { number: 9 },
    },
    ...overrides,
  };
}

describe("notion-gsc-reports.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
    resetIntegrationCacheAsync();
    process.env.NOTION_GSC_REPORTS_DB_ID = "gsc-db-123";
    process.env.NOTION_API_KEY = "secret_test_key_12345";
  });

  it("queries the GSC reports DB and maps a page to a report", async () => {
    mockNotionFetch.mockResolvedValueOnce({ results: [makeGscPage()] });

    const { getGscReports } = await import("@/lib/notion-gsc-reports");
    const reports = await getGscReports();

    expect(reports).toHaveLength(1);
    const r = reports![0];
    expect(r.id).toBe("notion-gsc-1");
    expect(r.week).toBe("Week of 2026-06-08");
    expect(r.date).toBe("2026-06-08");
    expect(r.clicks).toBe(1234);
    expect(r.impressions).toBe(56789);
    expect(r.ctrPct).toBe(3.5);
    expect(r.avgPosition).toBe(12.4);
    expect(r.keywords).toBe(87);
    expect(r.topCountry).toBe("GR");
    expect(r.mobilePct).toBe(61.2);
    expect(r.ctrOpportunities).toBe(9);
    expect(r.topKeywords).toEqual([
      { q: "cloud consulting", clicks: 40, ctr: 5.1 },
      { q: "aws audit", clicks: 22, ctr: 3.0 },
    ]);
    expect(mockNotionFetch).toHaveBeenCalledWith(
      `/databases/gsc-db-123/query`,
      expect.objectContaining({ method: "POST" })
    );
  });

  it("sorts by Date descending and clamps page_size", async () => {
    mockNotionFetch.mockResolvedValueOnce({ results: [] });

    const { getGscReports } = await import("@/lib/notion-gsc-reports");
    await getGscReports(500);

    const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
    expect(body.sorts).toEqual([{ property: "Date", direction: "descending" }]);
    expect(body.page_size).toBe(100); // clamped from 500
  });

  it("defaults missing numbers to 0 and empty top-keywords to []", async () => {
    mockNotionFetch.mockResolvedValueOnce({
      results: [
        makeGscPage({
          properties: {
            Week: { title: [{ plain_text: "Week of 2026-06-01" }] },
            Date: { date: { start: "2026-06-01" } },
            // all numeric + rich_text props omitted
          },
        }),
      ],
    });

    const { getGscReports } = await import("@/lib/notion-gsc-reports");
    const reports = await getGscReports();
    const r = reports![0];
    expect(r.clicks).toBe(0);
    expect(r.impressions).toBe(0);
    expect(r.ctrPct).toBe(0);
    expect(r.topCountry).toBe("");
    expect(r.topKeywords).toEqual([]);
  });

  it("tolerates malformed Top Keywords JSON", async () => {
    mockNotionFetch.mockResolvedValueOnce({
      results: [
        makeGscPage({
          properties: {
            ...makeGscPage().properties,
            "Top Keywords": { rich_text: [{ plain_text: "{not valid json" }] },
          },
        }),
      ],
    });

    const { getGscReports } = await import("@/lib/notion-gsc-reports");
    const reports = await getGscReports();
    expect(reports![0].topKeywords).toEqual([]);
  });

  it("throws when NOTION_GSC_REPORTS_DB_ID not configured", async () => {
    process.env.NOTION_GSC_REPORTS_DB_ID = "";
    resetIntegrationCache();
    resetIntegrationCacheAsync();

    const { getGscReports } = await import("@/lib/notion-gsc-reports");
    await expect(getGscReports()).rejects.toBeInstanceOf(IntegrationNotConfiguredError);
    expect(mockNotionFetch).not.toHaveBeenCalled();
  });

  it("throws when NOTION_API_KEY not configured", async () => {
    process.env.NOTION_API_KEY = "";
    resetIntegrationCache();
    resetIntegrationCacheAsync();

    const { getGscReports } = await import("@/lib/notion-gsc-reports");
    await expect(getGscReports()).rejects.toBeInstanceOf(IntegrationNotConfiguredError);
    expect(mockNotionFetch).not.toHaveBeenCalled();
  });

  it("returns null on Notion API error", async () => {
    mockNotionFetch.mockRejectedValueOnce(new Error("Notion API 502"));

    const { getGscReports } = await import("@/lib/notion-gsc-reports");
    const reports = await getGscReports();
    expect(reports).toBeNull();
  });
});
