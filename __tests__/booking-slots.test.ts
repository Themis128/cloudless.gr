import { describe, it, expect } from "vitest";
import {
  formatAthensSlot,
  formatAthensSlotsTable,
  clampDaysAhead,
  MIN_DAYS_AHEAD,
  MAX_DAYS_AHEAD,
  DEFAULT_DAYS_AHEAD,
} from "@/lib/booking-slots";

describe("booking-slots", () => {
  describe("constants", () => {
    it("uses the documented window bounds", () => {
      expect(MIN_DAYS_AHEAD).toBe(1);
      expect(MAX_DAYS_AHEAD).toBe(14);
      expect(DEFAULT_DAYS_AHEAD).toBe(7);
      expect(MIN_DAYS_AHEAD).toBeLessThan(MAX_DAYS_AHEAD);
      expect(DEFAULT_DAYS_AHEAD).toBeGreaterThanOrEqual(MIN_DAYS_AHEAD);
      expect(DEFAULT_DAYS_AHEAD).toBeLessThanOrEqual(MAX_DAYS_AHEAD);
    });
  });

  describe("formatAthensSlot", () => {
    it("renders ISO start/end as `<date> <start>–<end> Athens`", () => {
      // 2026-08-12T07:00:00Z = 10:00 Athens (UTC+3, DST)
      const out = formatAthensSlot("2026-08-12T07:00:00Z", "2026-08-12T07:30:00Z");
      expect(out).toContain("Athens");
      expect(out).toContain("–");
      // The Athens hour for that UTC instant is 10 (DST). The label must
      // contain a 10:xx start and 10:30 end.
      expect(out).toMatch(/10:00/);
      expect(out).toMatch(/10:30/);
    });

    it("does not include the timezone offset in the label", () => {
      const out = formatAthensSlot("2026-08-12T07:00:00Z", "2026-08-12T07:30:00Z");
      // We label "Athens" rather than "+03:00" so the user sees a city
      // name. A regression that re-introduces "+03" would break the UX.
      expect(out).not.toMatch(/\+0?3/);
      expect(out).not.toMatch(/GMT/);
    });
  });

  describe("formatAthensSlotsTable", () => {
    // Slots that correspond to 09:00–10:30 Athens summer time (UTC+3)
    const slots = [
      { start: "2026-08-28T06:00:00.000Z", end: "2026-08-28T06:30:00.000Z" },
      { start: "2026-08-28T06:30:00.000Z", end: "2026-08-28T07:00:00.000Z" },
      { start: "2026-08-28T07:00:00.000Z", end: "2026-08-28T07:30:00.000Z" },
    ];

    it("outputs a markdown table with header row", () => {
      const table = formatAthensSlotsTable(slots);
      expect(table).toContain("| # | Day | Time (Athens) |");
      expect(table).toContain("| --- | --- | --- |");
    });

    it("has one data row per slot", () => {
      const table = formatAthensSlotsTable(slots);
      const rows = table.split("\n").filter((l) => /^\| \d/.test(l));
      expect(rows).toHaveLength(3);
    });

    it("includes ISO refs by default", () => {
      const table = formatAthensSlotsTable(slots);
      expect(table).toContain("start=2026-08-28T06:00:00.000Z");
    });

    it("omits ISO refs when includeRefs=false", () => {
      const table = formatAthensSlotsTable(slots, { includeRefs: false });
      expect(table).not.toContain("start=");
    });

    it("renders Athens time (UTC+3 in summer), not UTC", () => {
      const table = formatAthensSlotsTable(slots);
      // 06:00 UTC = 09:00 Athens summer
      expect(table).toContain("09:00");
    });
  });

  describe("clampDaysAhead", () => {
    it("returns the default for non-numeric input", () => {
      expect(clampDaysAhead(undefined)).toBe(DEFAULT_DAYS_AHEAD);
      expect(clampDaysAhead(null)).toBe(DEFAULT_DAYS_AHEAD);
      expect(clampDaysAhead("seven")).toBe(DEFAULT_DAYS_AHEAD);
      expect(clampDaysAhead({})).toBe(DEFAULT_DAYS_AHEAD);
      expect(clampDaysAhead([])).toBe(DEFAULT_DAYS_AHEAD);
    });

    it("returns the default for NaN/Infinity", () => {
      expect(clampDaysAhead(NaN)).toBe(DEFAULT_DAYS_AHEAD);
      expect(clampDaysAhead(Infinity)).toBe(DEFAULT_DAYS_AHEAD);
      expect(clampDaysAhead(-Infinity)).toBe(DEFAULT_DAYS_AHEAD);
    });

    it("clamps below MIN to MIN", () => {
      expect(clampDaysAhead(0)).toBe(MIN_DAYS_AHEAD);
      expect(clampDaysAhead(-5)).toBe(MIN_DAYS_AHEAD);
    });

    it("clamps above MAX to MAX", () => {
      expect(clampDaysAhead(20)).toBe(MAX_DAYS_AHEAD);
      expect(clampDaysAhead(1_000_000)).toBe(MAX_DAYS_AHEAD);
    });

    it("truncates fractional values", () => {
      expect(clampDaysAhead(3.7)).toBe(3);
      expect(clampDaysAhead(7.999)).toBe(7);
    });

    it("passes valid integers through unchanged", () => {
      for (let n = MIN_DAYS_AHEAD; n <= MAX_DAYS_AHEAD; n++) {
        expect(clampDaysAhead(n)).toBe(n);
      }
    });
  });
});
