/**
 * Tails for src/lib/store-products.ts async paths — Stripe live catalog,
 * cache hit, and category filtering. Only the Stripe list boundary is stubbed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const listStripeProducts = vi.fn();
vi.mock("@/lib/stripe", () => ({
  listStripeProducts: (...args: unknown[]) => listStripeProducts(...args),
}));

import {
  getProducts,
  getProductsByCategoryAsync,
  defaultProducts,
} from "@/lib/store-products";

const STRIPE_PRODUCT = {
  id: "prod_stripe_1",
  name: "Cloud Audit (Stripe)",
  description: "Live Stripe product",
  defaultPrice: { unitAmount: 4900, currency: "EUR", recurring: null },
  images: [],
  metadata: { category: "service", features: "fast,thorough" },
};

describe("store-products async tails", () => {
  beforeEach(() => {
    vi.resetModules();
    listStripeProducts.mockReset();
  });

  it("serves the live Stripe catalog, then the cache on the second call", async () => {
    const mod = await import("@/lib/store-products");
    listStripeProducts.mockResolvedValue([STRIPE_PRODUCT]);
    const first = await mod.getProducts();
    expect(first).toHaveLength(1);
    expect(first[0].id).toBe("prod_stripe_1");
    expect(first[0].price).toBe(4900);
    expect(first[0].features).toEqual(["fast", "thorough"]);

    // Second call within TTL hits the cache — no extra Stripe request.
    listStripeProducts.mockRejectedValue(new Error("should not be called"));
    const second = await mod.getProducts();
    expect(second[0].id).toBe("prod_stripe_1");
    expect(listStripeProducts).toHaveBeenCalledTimes(1);
  });

  it("falls back to the default catalog when Stripe returns nothing", async () => {
    const mod = await import("@/lib/store-products");
    listStripeProducts.mockResolvedValue([]);
    const products = await mod.getProducts();
    expect(products).toEqual(defaultProducts);
  });

  it("getProductsByCategoryAsync filters the loaded catalog", async () => {
    const mod = await import("@/lib/store-products");
    listStripeProducts.mockResolvedValue([STRIPE_PRODUCT]);
    const services = await mod.getProductsByCategoryAsync("service");
    expect(services.map((p) => p.id)).toEqual(["prod_stripe_1"]);
    const digital = await mod.getProductsByCategoryAsync("digital");
    expect(digital).toEqual([]);
  });
});
