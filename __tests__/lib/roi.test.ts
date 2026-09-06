import { describe, it, expect } from "vitest";
import {
  microsToCents,
  currencyStringToCents,
  unitsToCents,
  computeCostPerLeadCents,
  computeRoas,
} from "@/lib/roi";

describe("microsToCents", () => {
  it("converts micros to cents (divides by 10 000 and rounds)", () => {
    expect(microsToCents(1_000_000)).toBe(100); // 1 unit = 100 cents
    expect(microsToCents(500_000)).toBe(50);
    expect(microsToCents(333_333)).toBe(33); // floors/rounds
  });

  it("returns 0 for zero or falsy values", () => {
    expect(microsToCents(0)).toBe(0);
  });
});

describe("currencyStringToCents", () => {
  it("parses a decimal string to cents", () => {
    expect(currencyStringToCents("12.34")).toBe(1234);
    expect(currencyStringToCents("100")).toBe(10000);
  });

  it("returns 0 for undefined", () => {
    expect(currencyStringToCents(undefined)).toBe(0);
  });

  it("returns 0 for non-numeric string", () => {
    expect(currencyStringToCents("abc")).toBe(0);
  });

  it("returns 0 for zero or negative", () => {
    expect(currencyStringToCents("0")).toBe(0);
    expect(currencyStringToCents("-5")).toBe(0);
  });
});

describe("unitsToCents", () => {
  it("converts whole units to cents", () => {
    expect(unitsToCents(49)).toBe(4900);
    expect(unitsToCents(0.99)).toBe(99);
  });

  it("returns 0 for zero or negative", () => {
    expect(unitsToCents(0)).toBe(0);
    expect(unitsToCents(-10)).toBe(0);
  });

  it("returns 0 for Infinity", () => {
    expect(unitsToCents(Infinity)).toBe(0);
  });
});

describe("computeCostPerLeadCents", () => {
  it("computes spend / leads", () => {
    expect(computeCostPerLeadCents(10_000, 5)).toBe(2000);
  });

  it("returns null when newLeads is null", () => {
    expect(computeCostPerLeadCents(10_000, null)).toBeNull();
  });

  it("returns null when newLeads is 0", () => {
    expect(computeCostPerLeadCents(10_000, 0)).toBeNull();
  });

  it("returns null when spendCents is 0", () => {
    expect(computeCostPerLeadCents(0, 5)).toBeNull();
  });
});

describe("computeRoas", () => {
  it("returns revenueCents / spendCents (2 decimal places)", () => {
    expect(computeRoas(100_00, 300_00)).toBe(3.0);
    expect(computeRoas(100_00, 250_00)).toBe(2.5);
  });

  it("returns null when revenueCents is null", () => {
    expect(computeRoas(100_00, null)).toBeNull();
  });

  it("returns null when spendCents is 0", () => {
    expect(computeRoas(0, 300_00)).toBeNull();
  });

  it("handles fractional roas with rounding", () => {
    // 100 / 300 = 0.333... → 0.33
    expect(computeRoas(300, 100)).toBe(0.33);
  });
});
