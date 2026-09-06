/**
 * Tests for src/lib/product-recommendation-signals.ts
 *
 * buildCoPurchaseSignals is a pure function — full branch coverage possible.
 */
import { describe, it, expect } from "vitest";
import { buildCoPurchaseSignals, type ProductOrderSignal } from "@/lib/product-recommendation-signals";

describe("buildCoPurchaseSignals", () => {
  it("returns empty array for empty input", () => {
    expect(buildCoPurchaseSignals([])).toEqual([]);
  });

  it("returns empty array for single-item orders (no co-purchases)", () => {
    const result = buildCoPurchaseSignals([["p1"], ["p2"]]);
    expect(result).toEqual([]);
  });

  it("builds symmetric pairs from a two-item order", () => {
    const result = buildCoPurchaseSignals([["p1", "p2"]]);
    expect(result).toHaveLength(2);
    const pairMap = Object.fromEntries(result.map((r) => [`${r.productId}-${r.relatedProductId}`, r.count]));
    expect(pairMap["p1-p2"]).toBe(1);
    expect(pairMap["p2-p1"]).toBe(1);
  });

  it("accumulates counts across multiple orders", () => {
    const result = buildCoPurchaseSignals([["p1", "p2"], ["p1", "p2"], ["p1", "p2"]]);
    const p1p2 = result.find((r) => r.productId === "p1" && r.relatedProductId === "p2");
    expect(p1p2?.count).toBe(3);
  });

  it("counts each pair only once per order (deduplicates within order)", () => {
    // p1 appears twice in the same order — should count as one co-purchase
    const result = buildCoPurchaseSignals([["p1", "p1", "p2"]]);
    const p1p2 = result.find((r) => r.productId === "p1" && r.relatedProductId === "p2");
    expect(p1p2?.count).toBe(1);
  });

  it("ignores empty string product IDs", () => {
    const result = buildCoPurchaseSignals([["", "p1", "p2"]]);
    const withEmpty = result.filter((r) => r.productId === "" || r.relatedProductId === "");
    expect(withEmpty).toHaveLength(0);
  });

  it("trims whitespace from product IDs", () => {
    const result = buildCoPurchaseSignals([["  p1  ", "p2"]]);
    const p1p2 = result.find((r) => r.productId === "p1" && r.relatedProductId === "p2");
    expect(p1p2).toBeDefined();
  });

  it("sorts by count descending", () => {
    const orders = [
      ["p1", "p2"],
      ["p1", "p2"],
      ["p1", "p3"],
    ];
    const result = buildCoPurchaseSignals(orders);
    const counts = result.map((r) => r.count);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  it("breaks count ties by productId then relatedProductId", () => {
    // Both (p1,p2) and (p3,p4) appear once
    const result = buildCoPurchaseSignals([["p1", "p2"], ["p3", "p4"]]);
    // p1 < p3 lexicographically, so p1-p2 should come first among same count
    const p1Idx = result.findIndex((r) => r.productId === "p1");
    const p3Idx = result.findIndex((r) => r.productId === "p3");
    // The pair with productId "p1" should appear before "p3"
    expect(p1Idx).toBeLessThan(p3Idx);
  });

  it("handles many orders correctly", () => {
    const orders = Array.from({ length: 10 }, () => ["p1", "p2", "p3"]);
    const result = buildCoPurchaseSignals(orders);
    const top = result[0];
    expect(top.count).toBe(10);
  });

  it("does not include self-references", () => {
    const result = buildCoPurchaseSignals([["p1", "p2"]]);
    const selfRefs = result.filter((r) => r.productId === r.relatedProductId);
    expect(selfRefs).toHaveLength(0);
  });

  it("returns typed ProductOrderSignal objects", () => {
    const result = buildCoPurchaseSignals([["a", "b"]]);
    const sig: ProductOrderSignal = result[0];
    expect(typeof sig.productId).toBe("string");
    expect(typeof sig.relatedProductId).toBe("string");
    expect(typeof sig.count).toBe("number");
  });
});
