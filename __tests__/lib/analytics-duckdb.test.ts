/**
 * Tests for src/lib/analytics-duckdb.ts
 *
 * The module only exports type interfaces and the ANALYTICS_QUERIES constant.
 * Coverage is achieved by importing and verifying the constant.
 */
import { describe, it, expect } from "vitest";
import { ANALYTICS_QUERIES } from "@/lib/analytics-duckdb";

describe("ANALYTICS_QUERIES (duckdb)", () => {
  it("has all expected query keys", () => {
    expect(Object.keys(ANALYTICS_QUERIES)).toEqual(
      expect.arrayContaining([
        "dailyFunnel",
        "statusBreakdown",
        "topEndpoints",
      ])
    );
  });

  it("every query is a non-empty SQL string", () => {
    for (const [, sql] of Object.entries(ANALYTICS_QUERIES)) {
      expect(typeof sql).toBe("string");
      expect(sql.trim().length).toBeGreaterThan(0);
      expect(sql.toUpperCase()).toContain("SELECT");
    }
  });

  it("dailyFunnel reads from parquet", () => {
    expect(ANALYTICS_QUERIES.dailyFunnel).toContain("read_parquet");
  });

  it("statusBreakdown groups by status", () => {
    expect(ANALYTICS_QUERIES.statusBreakdown.toLowerCase()).toContain("group by");
  });
});
