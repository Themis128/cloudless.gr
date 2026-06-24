import { describe, expect, it } from "vitest";

import { buildCoPurchaseSignals } from "@/lib/product-recommendation-signals";

describe("R21 order-history recommendation signals", () => {
  it("builds directed co-purchase counts from order product IDs", () => {
    const signals = buildCoPurchaseSignals([
      ["analytics-starter", "ai-growth-pack"],
      ["analytics-starter", "ai-growth-pack"],
      ["analytics-starter", "serverless-audit"],
    ]);

    expect(signals).toContainEqual({
      productId: "analytics-starter",
      relatedProductId: "ai-growth-pack",
      count: 2,
    });

    expect(signals).toContainEqual({
      productId: "ai-growth-pack",
      relatedProductId: "analytics-starter",
      count: 2,
    });

    expect(signals).toContainEqual({
      productId: "analytics-starter",
      relatedProductId: "serverless-audit",
      count: 1,
    });
  });

  it("deduplicates repeated product IDs within one order", () => {
    const signals = buildCoPurchaseSignals([
      ["analytics-starter", "analytics-starter", "ai-growth-pack"],
    ]);

    expect(signals).toEqual([
      {
        productId: "ai-growth-pack",
        relatedProductId: "analytics-starter",
        count: 1,
      },
      {
        productId: "analytics-starter",
        relatedProductId: "ai-growth-pack",
        count: 1,
      },
    ]);
  });

  it("ignores empty product IDs", () => {
    const signals = buildCoPurchaseSignals([
      ["analytics-starter", "", "   ", "ai-growth-pack"],
    ]);

    expect(signals).toHaveLength(2);
  });
});
