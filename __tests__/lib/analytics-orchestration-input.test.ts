import { describe, it, expect } from "vitest";
import {
  ALLOWED_ANALYTICS_CONNECTORS,
  DEFAULT_ANALYTICS_CONNECTORS,
  parseAnalyticsOrchestrationRequestBody,
} from "@/lib/analytics-orchestration-input";

describe("ALLOWED_ANALYTICS_CONNECTORS", () => {
  it("is a non-empty array", () => {
    expect(ALLOWED_ANALYTICS_CONNECTORS.length).toBeGreaterThan(0);
  });

  it("includes quicksight", () => {
    expect(ALLOWED_ANALYTICS_CONNECTORS).toContain("quicksight");
  });
});

describe("DEFAULT_ANALYTICS_CONNECTORS", () => {
  it("is a subset of ALLOWED_ANALYTICS_CONNECTORS", () => {
    for (const c of DEFAULT_ANALYTICS_CONNECTORS) {
      expect(ALLOWED_ANALYTICS_CONNECTORS).toContain(c);
    }
  });
});

describe("parseAnalyticsOrchestrationRequestBody", () => {
  it("returns defaults for empty body", () => {
    const result = parseAnalyticsOrchestrationRequestBody({});
    expect(result.windowDays).toBe(30);
    expect(result.reportTitle).toBe("Stripe Analytics Report");
    expect(result.connectors).toEqual(DEFAULT_ANALYTICS_CONNECTORS);
  });

  it("accepts valid connectors", () => {
    const result = parseAnalyticsOrchestrationRequestBody({ connectors: ["tableau"] });
    expect(result.connectors).toContain("tableau");
  });

  it("filters out invalid connectors and falls back to default", () => {
    const result = parseAnalyticsOrchestrationRequestBody({ connectors: ["invalid-one", "quicksight"] });
    expect(result.connectors).toContain("quicksight");
  });

  it("throws when windowDays is out of range", () => {
    expect(() => parseAnalyticsOrchestrationRequestBody({ windowDays: 0 })).toThrow("windowDays");
    expect(() => parseAnalyticsOrchestrationRequestBody({ windowDays: 999 })).toThrow("windowDays");
  });

  it("throws when reportTitle is empty string", () => {
    expect(() => parseAnalyticsOrchestrationRequestBody({ reportTitle: "" })).toThrow("reportTitle");
  });

  it("parses goals array", () => {
    const result = parseAnalyticsOrchestrationRequestBody({ goals: ["increase revenue", "reduce churn"] });
    expect(result.goals).toHaveLength(2);
  });
});
