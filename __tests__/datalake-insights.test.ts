import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  INSIGHT_DOMAINS,
  INSIGHTS_INDEX_KEY,
  insightObjectKey,
  isInsightDomain,
  INSIGHT_SECTION_MAP,
} from "@/lib/datalake-insights";

const { readMocks } = vi.hoisted(() => ({
  readMocks: {
    get: vi.fn(),
  },
}));

vi.mock("@/lib/r2-client", () => ({
  getDataLakeBucketFromEnv: () => ({
    get: readMocks.get,
  }),
}));

describe("datalake-insights contract", () => {
  it("lists expected domains", () => {
    expect(INSIGHT_DOMAINS).toContain("seo");
    expect(INSIGHT_DOMAINS).toContain("revenue");
    expect(INSIGHT_DOMAINS).toContain("orchestration");
    expect(INSIGHT_DOMAINS).toContain("executive");
  });

  it("builds object keys under lake/snapshots/insights", () => {
    expect(insightObjectKey("seo")).toBe("lake/snapshots/insights/seo.json");
    expect(INSIGHTS_INDEX_KEY).toBe("lake/snapshots/insights/insights-index.json");
  });

  it("validates domain names", () => {
    expect(isInsightDomain("seo")).toBe(true);
    expect(isInsightDomain("nope")).toBe(false);
  });

  it("maps domains to gold sections", () => {
    expect(INSIGHT_SECTION_MAP.revenue).toContain("stripe_revenue");
    expect(INSIGHT_SECTION_MAP.seo).toContain("top_keywords");
  });
});

describe("listInsightDomains", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns empty domains array when R2 index is a stub object", async () => {
    readMocks.get.mockResolvedValue({
      text: async () => "{}",
    });
    const { listInsightDomains } = await import("@/lib/datalake-serve");
    const index = await listInsightDomains();
    expect(Array.isArray(index.domains)).toBe(true);
    expect(index.domains).toEqual([]);
    expect(typeof index.generated_at).toBe("string");
  });

  it("returns domains from a valid insights index", async () => {
    readMocks.get.mockResolvedValue({
      text: async () =>
        JSON.stringify({
          generated_at: "2026-08-13T12:00:00.000Z",
          domains: [
            { domain: "revenue", generated_at: "2026-08-13T12:00:00.000Z", has_error: false },
          ],
        }),
    });
    const { listInsightDomains } = await import("@/lib/datalake-serve");
    const index = await listInsightDomains();
    expect(index.domains).toHaveLength(1);
    expect(index.domains[0].domain).toBe("revenue");
  });
});
