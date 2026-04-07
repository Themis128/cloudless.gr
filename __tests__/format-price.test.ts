import { describe, it, expect } from "vitest";
import { formatPrice } from "@/lib/format-price";

describe("formatPrice", () => {
  it("formats cents to EUR by default", () => {
    const result = formatPrice(4900);
    expect(result).toContain("49");
    expect(result).toMatch(/€/);
  });

  it("handles zero", () => {
    expect(formatPrice(0)).toContain("0");
  });

  it("respects the currency parameter", () => {
    const result = formatPrice(2500, "usd");
    expect(result).toMatch(/\$|USD/);
  });

  it("handles large amounts", () => {
    const result = formatPrice(240000);
    expect(result).toContain("2,400");
  });

  it("is case-insensitive for currency codes", () => {
    const lower = formatPrice(1000, "eur");
    const upper = formatPrice(1000, "EUR");
    expect(lower).toBe(upper);
  });
});
