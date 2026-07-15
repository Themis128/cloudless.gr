import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/store-products", () => ({
  getProducts: async () => [
    {
      id: "analytics-starter",
      name: "Analytics Starter",
      category: "analytics",
      description: "Athena dashboards and Stripe reporting.",
      price: 490,
      currency: "EUR",
      features: ["Athena dashboards", "Stripe reporting", "weekly insights"],
    },
    {
      id: "analytics-growth",
      name: "Analytics Growth",
      category: "analytics",
      description: "Advanced dashboards and growth reporting.",
      price: 790,
      currency: "EUR",
      features: ["Athena dashboards", "growth reporting"],
    },
    {
      id: "serverless-audit",
      name: "Serverless Audit",
      category: "infrastructure",
      description: "Review Lambda and DynamoDB posture.",
      price: 790,
      currency: "EUR",
      features: ["AWS Lambda review", "DynamoDB cost check"],
    },
    {
      id: "ai-growth-pack",
      name: "AI Growth Pack",
      category: "ai",
      description: "Product copy and recommendations.",
      price: 990,
      currency: "EUR",
      features: ["GenAI copy", "recommendations", "semantic search"],
    },
  ],
}));

import { recommendProductsForProduct } from "@/lib/product-recommendations";

describe("R21 product recommendations", () => {
  it("recommends products from the same category first", async () => {
    const recommendations = await recommendProductsForProduct("analytics-starter", 3);

    expect(recommendations.map((product) => product.id)).toContain("analytics-growth");
    expect(recommendations[0].id).toBe("analytics-growth");
  });

  it("does not recommend the current product", async () => {
    const recommendations = await recommendProductsForProduct("analytics-starter", 3);

    expect(recommendations.map((product) => product.id)).not.toContain("analytics-starter");
  });

  it("respects the result limit", async () => {
    const recommendations = await recommendProductsForProduct("analytics-starter", 1);

    expect(recommendations).toHaveLength(1);
  });

  it("returns an empty list for unknown product IDs", async () => {
    const recommendations = await recommendProductsForProduct("missing-product", 3);

    expect(recommendations).toEqual([]);
  });
});

describe("R21 product recommendations with order-history signals", () => {
  it("uses co-purchase signals as an optional ranking boost", async () => {
    const recommendations = await recommendProductsForProduct("analytics-starter", 3, {
      signals: [
        {
          productId: "analytics-starter",
          relatedProductId: "ai-growth-pack",
          count: 20,
        },
      ],
    });

    expect(recommendations[0].id).toBe("ai-growth-pack");
  });

  it("keeps existing behavior when no signals are provided", async () => {
    const recommendations = await recommendProductsForProduct("analytics-starter", 3);

    expect(recommendations[0].id).toBe("analytics-growth");
  });
});
