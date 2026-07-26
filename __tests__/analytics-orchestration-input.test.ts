import { describe, it, expect } from "vitest";
import {
  ALLOWED_ANALYTICS_CONNECTORS,
  DEFAULT_ANALYTICS_CONNECTORS,
  parseAnalyticsOrchestrationRequestBody,
} from "@/lib/analytics-orchestration-input";

describe("ALLOWED_ANALYTICS_CONNECTORS", () => {
  it("contains the expected connectors", () => {
    expect(ALLOWED_ANALYTICS_CONNECTORS).toContain("quicksight");
    expect(ALLOWED_ANALYTICS_CONNECTORS).toContain("powerbi");
    expect(ALLOWED_ANALYTICS_CONNECTORS).toContain("tableau");
    expect(ALLOWED_ANALYTICS_CONNECTORS).toContain("lookerstudio");
    expect(ALLOWED_ANALYTICS_CONNECTORS).toContain("metabase");
  });

  it("DEFAULT_ANALYTICS_CONNECTORS is a subset of allowed", () => {
    for (const c of DEFAULT_ANALYTICS_CONNECTORS) {
      expect(ALLOWED_ANALYTICS_CONNECTORS).toContain(c);
    }
  });
});

describe("parseAnalyticsOrchestrationRequestBody()", () => {
  it("returns defaults for an empty object", () => {
    const result = parseAnalyticsOrchestrationRequestBody({});
    expect(result.windowDays).toBe(30);
    expect(result.connectors).toEqual(DEFAULT_ANALYTICS_CONNECTORS);
    expect(result.goals).toEqual([]);
    expect(result.reportTitle).toBe("Stripe Analytics Report");
  });

  it("accepts a valid windowDays value", () => {
    const result = parseAnalyticsOrchestrationRequestBody({ windowDays: 7 });
    expect(result.windowDays).toBe(7);
  });

  it("truncates fractional windowDays", () => {
    const result = parseAnalyticsOrchestrationRequestBody({ windowDays: 14.9 });
    expect(result.windowDays).toBe(14);
  });

  it("throws when windowDays is 0", () => {
    expect(() => parseAnalyticsOrchestrationRequestBody({ windowDays: 0 })).toThrow(
      "windowDays must be between 1 and 365"
    );
  });

  it("throws when windowDays is 366", () => {
    expect(() => parseAnalyticsOrchestrationRequestBody({ windowDays: 366 })).toThrow(
      "windowDays must be between 1 and 365"
    );
  });

  it("throws when windowDays is not a number", () => {
    expect(() => parseAnalyticsOrchestrationRequestBody({ windowDays: "bad" })).toThrow(
      "windowDays must be between 1 and 365"
    );
  });

  it("filters out invalid connectors", () => {
    const result = parseAnalyticsOrchestrationRequestBody({
      connectors: ["quicksight", "invalid-tool"],
    });
    expect(result.connectors).toEqual(["quicksight"]);
  });

  it("throws when connectors array contains only invalid entries", () => {
    expect(() => parseAnalyticsOrchestrationRequestBody({ connectors: ["bad-tool"] })).toThrow(
      "At least one valid connector is required"
    );
  });

  it("falls back to defaults when connectors is an empty array", () => {
    const result = parseAnalyticsOrchestrationRequestBody({ connectors: [] });
    expect(result.connectors).toEqual(DEFAULT_ANALYTICS_CONNECTORS);
  });

  it("deduplicates connectors", () => {
    const result = parseAnalyticsOrchestrationRequestBody({
      connectors: ["quicksight", "quicksight", "powerbi"],
    });
    expect(result.connectors).toEqual(["quicksight", "powerbi"]);
  });

  it("parses goals array", () => {
    const result = parseAnalyticsOrchestrationRequestBody({
      goals: ["increase revenue", "reduce churn"],
    });
    expect(result.goals).toEqual(["increase revenue", "reduce churn"]);
  });

  it("ignores non-array goals", () => {
    const result = parseAnalyticsOrchestrationRequestBody({ goals: "not-array" });
    expect(result.goals).toEqual([]);
  });

  it("filters empty strings from goals", () => {
    const result = parseAnalyticsOrchestrationRequestBody({ goals: ["valid", "", "  "] });
    expect(result.goals).toEqual(["valid"]);
  });

  it("accepts a custom reportTitle", () => {
    const result = parseAnalyticsOrchestrationRequestBody({ reportTitle: "Q1 Report" });
    expect(result.reportTitle).toBe("Q1 Report");
  });

  it("throws when reportTitle is an empty string", () => {
    expect(() => parseAnalyticsOrchestrationRequestBody({ reportTitle: "   " })).toThrow(
      "reportTitle cannot be empty"
    );
  });

  it("handles null/non-object body gracefully", () => {
    const result = parseAnalyticsOrchestrationRequestBody(null);
    expect(result.windowDays).toBe(30);
    expect(result.connectors).toEqual(DEFAULT_ANALYTICS_CONNECTORS);
  });

  it("handles array body gracefully (treated as empty)", () => {
    const result = parseAnalyticsOrchestrationRequestBody([]);
    expect(result.windowDays).toBe(30);
  });
});
