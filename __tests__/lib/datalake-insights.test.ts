import { describe, it, expect } from "vitest";
import {
  INSIGHT_DOMAINS,
  INSIGHTS_PREFIX,
  INSIGHTS_INDEX_KEY,
  insightObjectKey,
  isInsightDomain,
  INSIGHT_SECTION_MAP,
  type InsightDomain,
} from "@/lib/datalake-insights";

describe("INSIGHT_DOMAINS", () => {
  it("contains the expected domains", () => {
    expect(INSIGHT_DOMAINS).toContain("seo");
    expect(INSIGHT_DOMAINS).toContain("revenue");
    expect(INSIGHT_DOMAINS).toContain("executive");
    expect(INSIGHT_DOMAINS.length).toBeGreaterThan(0);
  });
});

describe("INSIGHTS_PREFIX", () => {
  it("starts with lake/snapshots", () => {
    expect(INSIGHTS_PREFIX).toMatch(/^lake\/snapshots/);
  });
});

describe("INSIGHTS_INDEX_KEY", () => {
  it("ends with insights-index.json", () => {
    expect(INSIGHTS_INDEX_KEY).toMatch(/insights-index\.json$/);
  });

  it("starts with INSIGHTS_PREFIX", () => {
    expect(INSIGHTS_INDEX_KEY.startsWith(INSIGHTS_PREFIX)).toBe(true);
  });
});

describe("insightObjectKey", () => {
  it("builds the correct path for a domain", () => {
    expect(insightObjectKey("seo")).toBe(`${INSIGHTS_PREFIX}/seo.json`);
    expect(insightObjectKey("revenue")).toBe(`${INSIGHTS_PREFIX}/revenue.json`);
  });

  it("works with string domains not in the enum", () => {
    expect(insightObjectKey("custom")).toBe(`${INSIGHTS_PREFIX}/custom.json`);
  });
});

describe("isInsightDomain", () => {
  it("returns true for known domains", () => {
    for (const domain of INSIGHT_DOMAINS) {
      expect(isInsightDomain(domain)).toBe(true);
    }
  });

  it("returns false for unknown domains", () => {
    expect(isInsightDomain("unknown")).toBe(false);
    expect(isInsightDomain("")).toBe(false);
  });
});

describe("INSIGHT_SECTION_MAP", () => {
  it("is a non-empty object", () => {
    expect(typeof INSIGHT_SECTION_MAP).toBe("object");
    expect(Object.keys(INSIGHT_SECTION_MAP).length).toBeGreaterThan(0);
  });

  it("each domain maps to an array of strings", () => {
    for (const [domain, sections] of Object.entries(INSIGHT_SECTION_MAP)) {
      expect(Array.isArray(sections)).toBe(true);
      expect(sections.length).toBeGreaterThan(0);
    }
  });
});
