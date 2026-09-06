import { describe, it, expect } from "vitest";
import {
  MIN_DAYS_AHEAD,
  MAX_DAYS_AHEAD,
  DEFAULT_DAYS_AHEAD,
  formatAthensSlot,
  formatAthensSlotDay,
  formatAthensSlotTimeRange,
  formatAthensSlotsTable,
  clampDaysAhead,
} from "@/lib/booking-slots";

describe("constants", () => {
  it("MIN_DAYS_AHEAD is 1", () => expect(MIN_DAYS_AHEAD).toBe(1));
  it("MAX_DAYS_AHEAD is 14", () => expect(MAX_DAYS_AHEAD).toBe(14));
  it("DEFAULT_DAYS_AHEAD is 7", () => expect(DEFAULT_DAYS_AHEAD).toBe(7));
});

describe("formatAthensSlot", () => {
  it("includes Athens timezone label", () => {
    const result = formatAthensSlot("2026-09-01T09:00:00Z", "2026-09-01T09:30:00Z");
    expect(result).toContain("Athens");
    expect(typeof result).toBe("string");
  });

  it("includes an en-dash between start and end", () => {
    const result = formatAthensSlot("2026-09-01T09:00:00Z", "2026-09-01T09:30:00Z");
    expect(result).toContain("–");
  });
});

describe("formatAthensSlotDay", () => {
  it("returns a short day string", () => {
    const result = formatAthensSlotDay("2026-09-01T09:00:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatAthensSlotTimeRange", () => {
  it("contains an en-dash", () => {
    const result = formatAthensSlotTimeRange("2026-09-01T09:00:00Z", "2026-09-01T09:30:00Z");
    expect(result).toContain("–");
  });

  it("returns HH:MM–HH:MM format", () => {
    const result = formatAthensSlotTimeRange("2026-09-01T09:00:00Z", "2026-09-01T09:30:00Z");
    expect(result).toMatch(/\d{2}:\d{2}–\d{2}:\d{2}/);
  });
});

describe("formatAthensSlotsTable", () => {
  const slots = [
    { start: "2026-09-01T09:00:00Z", end: "2026-09-01T09:30:00Z" },
    { start: "2026-09-01T10:00:00Z", end: "2026-09-01T10:30:00Z" },
  ];

  it("includes a markdown table header", () => {
    const result = formatAthensSlotsTable(slots);
    expect(result).toContain("| # | Day |");
  });

  it("includes one row per slot", () => {
    const result = formatAthensSlotsTable(slots);
    expect(result).toContain("| 1 |");
    expect(result).toContain("| 2 |");
  });

  it("includes slot refs by default", () => {
    const result = formatAthensSlotsTable(slots);
    expect(result).toContain("start=");
    expect(result).toContain("end=");
  });

  it("omits refs when includeRefs is false", () => {
    const result = formatAthensSlotsTable(slots, { includeRefs: false });
    expect(result).not.toContain("start=");
  });
});

describe("clampDaysAhead", () => {
  it("returns the input when within range", () => {
    expect(clampDaysAhead(5)).toBe(5);
    expect(clampDaysAhead(1)).toBe(1);
    expect(clampDaysAhead(14)).toBe(14);
  });

  it("clamps to MIN_DAYS_AHEAD when below", () => {
    expect(clampDaysAhead(0)).toBe(MIN_DAYS_AHEAD);
    expect(clampDaysAhead(-10)).toBe(MIN_DAYS_AHEAD);
  });

  it("clamps to MAX_DAYS_AHEAD when above", () => {
    expect(clampDaysAhead(100)).toBe(MAX_DAYS_AHEAD);
  });

  it("returns DEFAULT_DAYS_AHEAD for non-finite values", () => {
    expect(clampDaysAhead("abc")).toBe(DEFAULT_DAYS_AHEAD);
    expect(clampDaysAhead(null)).toBe(DEFAULT_DAYS_AHEAD);
    expect(clampDaysAhead(Infinity)).toBe(DEFAULT_DAYS_AHEAD);
    expect(clampDaysAhead(NaN)).toBe(DEFAULT_DAYS_AHEAD);
  });

  it("truncates decimal values", () => {
    expect(clampDaysAhead(5.9)).toBe(5);
    expect(clampDaysAhead(1.1)).toBe(1);
  });
});
