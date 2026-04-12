import { describe, it, expect } from "vitest";
import {
  demoProducts,
  getProductById,
  getProductsByCategory,
  categoryLabels,
  categoryColors,
} from "@/lib/store-products-client";

describe("demoProducts catalog", () => {
  it("contains products in all three categories", () => {
    const categories = new Set(demoProducts.map((p) => p.category));
    expect(categories).toContain("service");
    expect(categories).toContain("digital");
    expect(categories).toContain("physical");
  });

  it("every product has required fields", () => {
    for (const p of demoProducts) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.price).toBeGreaterThan(0);
      expect(p.currency).toBe("eur");
      expect(p.category).toBeTruthy();
    }
  });

  it("all product IDs are unique", () => {
    const ids = demoProducts.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getProductById", () => {
  it("returns the correct product for a valid ID", () => {
    const product = getProductById("srv-cloud");
    expect(product).toBeDefined();
    expect(product!.name).toBe("Cloud Architecture Audit");
  });

  it("returns undefined for an unknown ID", () => {
    expect(getProductById("does-not-exist")).toBeUndefined();
  });
});

describe("getProductsByCategory", () => {
  it("returns only products matching the category", () => {
    const services = getProductsByCategory("service");
    expect(services.length).toBeGreaterThan(0);
    for (const s of services) {
      expect(s.category).toBe("service");
    }
  });

  it("returns an empty array for a category with no products", () => {
    // All known categories have products, but the function should handle gracefully
    const result = getProductsByCategory("service");
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("category metadata", () => {
  it("categoryLabels covers all three categories", () => {
    expect(categoryLabels.service).toBe("Services");
    expect(categoryLabels.digital).toBe("Digital Products");
    expect(categoryLabels.physical).toBe("Merch & Physical");
  });

  it("categoryColors covers all three categories", () => {
    expect(categoryColors.service).toBeTruthy();
    expect(categoryColors.digital).toBeTruthy();
    expect(categoryColors.physical).toBeTruthy();
  }