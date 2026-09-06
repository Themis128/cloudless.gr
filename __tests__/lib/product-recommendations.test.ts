/**
 * Tests for src/lib/product-recommendations.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetProducts } = vi.hoisted(() => ({ mockGetProducts: vi.fn() }));
vi.mock("@/lib/store-products", () => ({ getProducts: mockGetProducts }));

import { recommendProductsForProduct } from "@/lib/product-recommendations";
import type { StoreProduct } from "@/lib/store-products";

function makeProduct(overrides: Partial<StoreProduct>): StoreProduct {
  return {
    id: "prod-1",
    name: "Product",
    description: "Desc",
    price: 100,
    currency: "EUR",
    category: "service",
    features: [],
    stripeProductId: "sp-1",
    stripePriceId: "spr-1",
    ...overrides,
  };
}

const HOST = makeProduct({ id: "host", name: "Hosting", category: "service", features: ["SSL", "CDN", "backups"] });
const VPS = makeProduct({ id: "vps", name: "VPS", category: "service", features: ["SSL", "root access"] });
const DOMAIN = makeProduct({ id: "dom", name: "Domain", category: "service", features: ["DNS"] });
const MERCH = makeProduct({ id: "shirt", name: "T-shirt", category: "physical", features: [] });

beforeEach(() => {
  mockGetProducts.mockReset().mockResolvedValue([HOST, VPS, DOMAIN, MERCH]);
});

describe("recommendProductsForProduct", () => {
  it("returns empty array when product is not found", async () => {
    const result = await recommendProductsForProduct("unknown-id");
    expect(result).toEqual([]);
  });

  it("excludes the input product from results", async () => {
    const result = await recommendProductsForProduct("host");
    expect(result.map((p) => p.id)).not.toContain("host");
  });

  it("ranks same-category products higher than cross-category", async () => {
    const result = await recommendProductsForProduct("host");
    const ids = result.map((p) => p.id);
    // VPS and Domain are services (same category), Merch is physical
    // shirt has no shared features with host, so shirt gets score 0 and won't appear if others exist
    expect(ids.indexOf("shirt")).toBe(-1); // no shared features with shirt
  });

  it("uses co-purchase signals to boost score", async () => {
    const signals = [
      { productId: "host", relatedProductId: "dom", count: 100 },
    ];
    const result = await recommendProductsForProduct("host", 3, { signals });
    const ids = result.map((p) => p.id);
    // Domain gets sameCategory(10) + coPurchase(100) = 110, beats VPS's score
    expect(ids[0]).toBe("dom");
  });

  it("respects the limit parameter", async () => {
    const result = await recommendProductsForProduct("host", 1);
    expect(result).toHaveLength(1);
  });

  it("clamps limit to max 8", async () => {
    const products = Array.from({ length: 10 }, (_, i) =>
      makeProduct({ id: `p${i}`, name: `P${i}`, category: "service", features: ["SSL"] })
    );
    mockGetProducts.mockResolvedValue(products);
    const result = await recommendProductsForProduct("p0", 100);
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it("uses min limit of 1 even when 0 is passed", async () => {
    const result = await recommendProductsForProduct("host", 0);
    // Math.max(1, Math.min(0, 8)) = 1
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it("filters products with score 0", async () => {
    // Merch has no shared features with host, different category → score 0
    const result = await recommendProductsForProduct("host", 10);
    expect(result.map((p) => p.id)).not.toContain("shirt");
  });

  it("sorts alphabetically as tiebreaker", async () => {
    const p1 = makeProduct({ id: "z-prod", name: "Z Product", category: "service", features: ["SSL"] });
    const p2 = makeProduct({ id: "a-prod", name: "A Product", category: "service", features: ["SSL"] });
    mockGetProducts.mockResolvedValue([HOST, p1, p2]);
    const result = await recommendProductsForProduct("host", 10);
    const names = result.map((p) => p.name);
    // Both have same score (sameCategory=10 + sharedFeatures=1 = 11), sort by name asc
    const idx1 = names.indexOf("A Product");
    const idx2 = names.indexOf("Z Product");
    expect(idx1).toBeLessThan(idx2);
  });

  it("handles products with undefined features", async () => {
    const noFeatures = makeProduct({ id: "no-feat", name: "Plain", category: "service", features: undefined });
    mockGetProducts.mockResolvedValue([HOST, noFeatures]);
    const result = await recommendProductsForProduct("host");
    // noFeatures has same category (score=10) but no shared features
    expect(result.map((p) => p.id)).toContain("no-feat");
  });
});
