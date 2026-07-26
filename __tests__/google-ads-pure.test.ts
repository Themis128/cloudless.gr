/**
 * Tests for pure/exported helpers in src/lib/campaigns/google-ads.ts.
 * No mocks — these exercise the deterministic transformation logic.
 */
import { describe, it, expect } from "vitest";
import {
  base64url,
  mapCampaignRow,
  parseMetricsRow,
  emptyMetrics,
  normalizeCustomerId,
  type GoogleCampaignRow,
  type GoogleMetricsRow,
} from "@/lib/campaigns/google-ads";

describe("base64url", () => {
  it("encodes a simple string without padding", () => {
    const result = base64url("hello");
    expect(result).toBe("aGVsbG8");
    expect(result).not.toContain("=");
  });

  it("replaces + with - and / with _", () => {
    // Buffer that produces + and / in standard base64
    const buf = Buffer.from([0xfb, 0xff, 0xfe]);
    const result = base64url(buf);
    expect(result).not.toContain("+");
    expect(result).not.toContain("/");
    expect(result).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("handles empty input", () => {
    expect(base64url("")).toBe("");
  });

  it("handles JSON payload like the JWT builder uses", () => {
    const payload = JSON.stringify({ alg: "RS256", typ: "JWT" });
    const result = base64url(payload);
    // Should be valid base64url characters only
    expect(result).toMatch(/^[A-Za-z0-9_-]+$/);
    // Should decode back correctly
    const decoded = Buffer.from(result, "base64url").toString();
    expect(decoded).toBe(payload);
  });
});

describe("normalizeCustomerId", () => {
  it("strips dashes from a formatted customer ID", () => {
    expect(normalizeCustomerId("123-456-7890")).toBe("1234567890");
  });

  it("returns plain digits unchanged", () => {
    expect(normalizeCustomerId("1234567890")).toBe("1234567890");
  });

  it("handles empty string", () => {
    expect(normalizeCustomerId("")).toBe("");
  });
});

describe("mapCampaignRow", () => {
  it("maps a full campaign row with budget", () => {
    const row: GoogleCampaignRow = {
      campaign: {
        id: "123",
        name: "Summer Sale",
        status: "ENABLED",
        advertisingChannelType: "SEARCH",
        startDate: "2024-06-01",
        endDate: "2024-09-01",
      },
      campaignBudget: { amountMicros: "50000000" },
    };
    const result = mapCampaignRow(row);
    expect(result).toEqual({
      id: "123",
      name: "Summer Sale",
      status: "ENABLED",
      advertisingChannelType: "SEARCH",
      budgetAmountMicros: "50000000",
      startDate: "2024-06-01",
      endDate: "2024-09-01",
    });
  });

  it("defaults budgetAmountMicros to '0' when campaignBudget is missing", () => {
    const row: GoogleCampaignRow = {
      campaign: {
        id: "456",
        name: "No Budget",
        status: "PAUSED",
        advertisingChannelType: "DISPLAY",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      },
    };
    expect(mapCampaignRow(row).budgetAmountMicros).toBe("0");
  });
});

describe("parseMetricsRow", () => {
  it("parses a complete metrics row", () => {
    const row: GoogleMetricsRow = {
      impressions: "15000",
      clicks: "350",
      costMicros: "2500000",
      conversions: "12.5",
      ctr: "0.023",
    };
    expect(parseMetricsRow(row)).toEqual({
      impressions: 15000,
      clicks: 350,
      costMicros: 2500000,
      conversions: 12.5,
      ctr: 0.023,
    });
  });

  it("returns zeros for missing fields", () => {
    expect(parseMetricsRow({})).toEqual(emptyMetrics());
  });

  it("returns empty metrics for null input", () => {
    expect(parseMetricsRow(null)).toEqual(emptyMetrics());
  });

  it("returns empty metrics for undefined input", () => {
    expect(parseMetricsRow(undefined)).toEqual(emptyMetrics());
  });

  it("handles partial data with some fields missing", () => {
    const row: GoogleMetricsRow = { impressions: "1000", clicks: "50" };
    const result = parseMetricsRow(row);
    expect(result.impressions).toBe(1000);
    expect(result.clicks).toBe(50);
    expect(result.costMicros).toBe(0);
    expect(result.conversions).toBe(0);
    expect(result.ctr).toBe(0);
  });
});

describe("emptyMetrics", () => {
  it("returns all zeros", () => {
    const m = emptyMetrics();
    expect(m.impressions).toBe(0);
    expect(m.clicks).toBe(0);
    expect(m.costMicros).toBe(0);
    expect(m.conversions).toBe(0);
    expect(m.ctr).toBe(0);
  });

  it("returns a new object each call", () => {
    const a = emptyMetrics();
    const b = emptyMetrics();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
