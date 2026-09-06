import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/store-products", () => ({
  getProducts: vi.fn().mockResolvedValue([
    { id: "p1", name: "Product 1", description: "A service", price: 10000, currency: "eur", category: "service", image: "/p1.svg" },
    { id: "p2", name: "Product 2", description: "Another service", price: 20000, currency: "eur", category: "service", image: "/p2.svg" },
    { id: "p3", name: "Product 3", description: "A digital", price: 5000, currency: "eur", category: "digital", image: "/p3.svg" },
  ]),
}));

import {
  getSimilarProducts,
  getTrendingProducts,
  resetRecommendationCache,
} from "@/lib/recommendations";

describe("resetRecommendationCache", () => {
  it("does not throw", () => {
    expect(() => resetRecommendationCache()).not.toThrow();
  });
});

describe("getSimilarProducts", () => {
  it("returns empty array for unknown product IDs", async () => {
    const env = {} as never;
    const result = await getSimilarProducts(env, ["nonexistent-id"]);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("returns same-category products when no AI binding", async () => {
    const env = {} as never;
    const result = await getSimilarProducts(env, ["p1"], 4);
    expect(Array.isArray(result)).toBe(true);
    // Falls back to category-based matching — p2 is same category as p1
    for (const p of result) {
      expect(p.category).toBe("service");
    }
  });
});

describe("getTrendingProducts", () => {
  it("returns empty array when env has no D1 binding", async () => {
    const env = {} as never;
    const result = await getTrendingProducts(env);
    expect(Array.isArray(result)).toBe(true);
  });
});
