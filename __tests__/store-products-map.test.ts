/**
 * Tests for mapStripeProduct and async product lookups in store-products.ts.
 * No mocks — exercises the pure mapping logic directly.
 */
import { describe, it, expect } from "vitest";
import { mapStripeProduct } from "@/lib/store-products";
import type { StripeProduct } from "@/lib/stripe";

function makeStripeProduct(overrides: Partial<StripeProduct> = {}): StripeProduct {
  return {
    id: "prod_123",
    name: "Test Product",
    description: "A test product",
    active: true,
    images: ["https://example.com/img.png"],
    metadata: {},
    defaultPrice: {
      id: "price_123",
      unitAmount: 9900,
      currency: "EUR",
      recurring: null,
    },
    ...overrides,
  };
}

describe("mapStripeProduct", () => {
  it("maps basic fields correctly", () => {
    const sp = makeStripeProduct();
    const result = mapStripeProduct(sp);
    expect(result.id).toBe("prod_123");
    expect(result.name).toBe("Test Product");
    expect(result.description).toBe("A test product");
    expect(result.price).toBe(9900);
    expect(result.currency).toBe("eur");
  });

  it("uses metadata.category when present", () => {
    const sp = makeStripeProduct({ metadata: { category: "digital" } });
    expect(mapStripeProduct(sp).category).toBe("digital");
  });

  it("defaults category to 'service' when not in metadata", () => {
    const sp = makeStripeProduct({ metadata: {} });
    expect(mapStripeProduct(sp).category).toBe("service");
  });

  it("uses metadata.image over product images", () => {
    const sp = makeStripeProduct({
      images: ["https://example.com/stripe-img.png"],
      metadata: { image: "/store/custom.svg" },
    });
    expect(mapStripeProduct(sp).image).toBe("/store/custom.svg");
  });

  it("falls back to first product image when metadata.image missing", () => {
    const sp = makeStripeProduct({
      images: ["https://example.com/first.png"],
      metadata: {},
    });
    expect(mapStripeProduct(sp).image).toBe("https://example.com/first.png");
  });

  it("defaults image to /store/default.svg when no images anywhere", () => {
    const sp = makeStripeProduct({ images: [], metadata: {} });
    expect(mapStripeProduct(sp).image).toBe("/store/default.svg");
  });

  it("parses comma-separated features from metadata", () => {
    const sp = makeStripeProduct({
      metadata: { features: "Feature A, Feature B, Feature C" },
    });
    const result = mapStripeProduct(sp);
    expect(result.features).toEqual(["Feature A", "Feature B", "Feature C"]);
  });

  it("returns undefined features when not in metadata", () => {
    const sp = makeStripeProduct({ metadata: {} });
    expect(mapStripeProduct(sp).features).toBeUndefined();
  });

  it("detects recurring products", () => {
    const sp = makeStripeProduct({
      defaultPrice: {
        id: "price_sub",
        unitAmount: 5000,
        currency: "EUR",
        recurring: { interval: "month", intervalCount: 1 },
      },
    });
    const result = mapStripeProduct(sp);
    expect(result.recurring).toBe(true);
    expect(result.interval).toBe("month");
  });

  it("marks non-recurring products as recurring=false", () => {
    const sp = makeStripeProduct();
    expect(mapStripeProduct(sp).recurring).toBe(false);
    expect(mapStripeProduct(sp).interval).toBeUndefined();
  });

  it("handles null defaultPrice gracefully", () => {
    const sp = makeStripeProduct({ defaultPrice: null });
    const result = mapStripeProduct(sp);
    expect(result.price).toBe(0);
    expect(result.currency).toBe("eur");
    expect(result.recurring).toBe(false);
  });

  it("handles null description", () => {
    const sp = makeStripeProduct({ description: null });
    expect(mapStripeProduct(sp).description).toBe("");
  });

  it("lowercases currency", () => {
    const sp = makeStripeProduct({
      defaultPrice: { id: "p", unitAmount: 100, currency: "USD", recurring: null },
    });
    expect(mapStripeProduct(sp).currency).toBe("usd");
  });
});
