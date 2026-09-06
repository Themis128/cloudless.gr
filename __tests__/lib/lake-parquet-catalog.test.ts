/**
 * Tests for src/lib/lake-parquet-catalog.ts
 */
import { describe, it, expect } from "vitest";
import {
  LAKE_PARQUET_CATALOG,
  lakeParquetPathById,
  isCatalogParquetPath,
} from "@/lib/lake-parquet-catalog";

describe("LAKE_PARQUET_CATALOG", () => {
  it("contains the expected entries", () => {
    expect(LAKE_PARQUET_CATALOG.length).toBeGreaterThan(10);
    const ids = LAKE_PARQUET_CATALOG.map((e) => e.id);
    expect(ids).toContain("gsc");
    expect(ids).toContain("stripe");
    expect(ids).toContain("rfm");
    expect(ids).toContain("churn");
  });

  it("every entry has id, label, and path", () => {
    for (const entry of LAKE_PARQUET_CATALOG) {
      expect(typeof entry.id).toBe("string");
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.label).toBe("string");
      expect(typeof entry.path).toBe("string");
      expect(entry.path.endsWith(".parquet")).toBe(true);
    }
  });
});

describe("lakeParquetPathById", () => {
  it("returns the correct path for a known id", () => {
    expect(lakeParquetPathById("gsc")).toBe("lake/gsc-keywords/keywords.parquet");
    expect(lakeParquetPathById("stripe")).toBe("lake/transactions/transactions.parquet");
    expect(lakeParquetPathById("rfm")).toBe("ml-parquet/scores_rfm.parquet");
    expect(lakeParquetPathById("churn")).toBe("ml-parquet/scores_churn.parquet");
  });

  it("returns null for an unknown id", () => {
    expect(lakeParquetPathById("unknown-dataset")).toBeNull();
    expect(lakeParquetPathById("")).toBeNull();
  });
});

describe("isCatalogParquetPath", () => {
  it("returns true for a valid path from the catalog", () => {
    expect(isCatalogParquetPath("lake/gsc-keywords/keywords.parquet")).toBe(true);
    expect(isCatalogParquetPath("ml-parquet/scores_rfm.parquet")).toBe(true);
  });

  it("returns false for a path not in the catalog", () => {
    expect(isCatalogParquetPath("lake/unknown/data.parquet")).toBe(false);
    expect(isCatalogParquetPath("")).toBe(false);
  });
});
