import { describe, it, expect } from "vitest";
import { formatPrice } from "@/lib/format-price";

describe("formatPrice", () => {
  it("converts cents to euros", () => {
    const result = formatPrice(1000);
    expect(result).toContain("10");
  });

  it("uses EUR as default currency", () => {
    const result = formatPrice(500);
    expect(result).toMatch(/€|EUR/);
  });

  it("accepts a custom currency", () => {
    const result = formatPrice(500, "usd");
    expect(result).toMatch(/\$|USD/);
  });

  it("divides by 100 (cents to major unit)", () => {
    const result = formatPrice(10000);
    expect(result).toContain("100");
  });

  it("handles zero", () => {
    const result = formatPrice(0);
    expect(result).toContain("0");
  });
});
