/**
 * Tests for pure/exported helpers in src/lib/campaigns/tiktok.ts.
 * No mocks — exercises deterministic transformation logic.
 */
import { describe, it, expect } from "vitest";
import {
  emptyInsights,
  parseInsightsRow,
  buildInsightsRequestBody,
  type TikTokReportRow,
} from "@/lib/campaigns/tiktok";

describe("emptyInsights", () => {
  it("returns all zeros as strings", () => {
    const r = emptyInsights();
    expect(r).toEqual({
      spend: "0",
      impressions: "0",
      clicks: "0",
      ctr: "0",
      cpc: "0",
      conversions: "0",
    });
  });

  it("returns a new object each call", () => {
    expect(emptyInsights()).not.toBe(emptyInsights());
  });
});

describe("parseInsightsRow", () => {
  it("parses a full metrics row", () => {
    const row: TikTokReportRow = {
      metrics: {
        spend: "150.50",
        impressions: "25000",
        clicks: "800",
        ctr: "0.032",
        cpc: "0.19",
        conversion: "42",
      },
    };
    expect(parseInsightsRow(row)).toEqual({
      spend: "150.50",
      impressions: "25000",
      clicks: "800",
      ctr: "0.032",
      cpc: "0.19",
      conversions: "42",
    });
  });

  it("maps 'conversion' key to 'conversions' in output", () => {
    const row: TikTokReportRow = { metrics: { conversion: "7" } };
    expect(parseInsightsRow(row).conversions).toBe("7");
  });

  it("returns zeros for missing metrics fields", () => {
    const row: TikTokReportRow = { metrics: { spend: "10" } };
    const r = parseInsightsRow(row);
    expect(r.spend).toBe("10");
    expect(r.impressions).toBe("0");
    expect(r.clicks).toBe("0");
    expect(r.ctr).toBe("0");
    expect(r.cpc).toBe("0");
    expect(r.conversions).toBe("0");
  });

  it("returns empty insights for null input", () => {
    expect(parseInsightsRow(null)).toEqual(emptyInsights());
  });

  it("returns empty insights for undefined input", () => {
    expect(parseInsightsRow(undefined)).toEqual(emptyInsights());
  });

  it("returns empty insights when row has no metrics key", () => {
    expect(parseInsightsRow({})).toEqual(emptyInsights());
  });
});

describe("buildInsightsRequestBody", () => {
  it("builds correct request body structure", () => {
    const body = buildInsightsRequestBody("adv123", "2024-06-01", "2024-06-30");
    expect(body).toEqual({
      advertiser_id: "adv123",
      report_type: "BASIC",
      data_level: "AUCTION_ADVERTISER",
      dimensions: ["stat_time_day"],
      metrics: ["spend", "impressions", "clicks", "ctr", "cpc", "conversion"],
      start_date: "2024-06-01",
      end_date: "2024-06-30",
      page_size: 1,
    });
  });

  it("uses the exact advertiser ID passed in", () => {
    const body = buildInsightsRequestBody("xyz-999", "2024-01-01", "2024-01-31");
    expect(body.advertiser_id).toBe("xyz-999");
  });
});
