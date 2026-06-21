import { describe, expect, it } from "vitest";
import { CHUNK_ERROR_PATTERN } from "@/components/ChunkReloadGuard";

describe("ChunkReloadGuard — CHUNK_ERROR_PATTERN", () => {
  it("matches known chunk-load failure messages", () => {
    expect(CHUNK_ERROR_PATTERN.test("ChunkLoadError: Loading chunk 5 failed")).toBe(true);
    expect(CHUNK_ERROR_PATTERN.test("Loading chunk 0q2ljv8a failed")).toBe(true);
    expect(
      CHUNK_ERROR_PATTERN.test(
        "error loading dynamically imported module: /_next/static/chunks/x.js"
      )
    ).toBe(true);
    expect(CHUNK_ERROR_PATTERN.test("Failed to fetch dynamically imported module")).toBe(true);
  });

  it("does not match unrelated runtime errors", () => {
    expect(CHUNK_ERROR_PATTERN.test("TypeError: x is undefined")).toBe(false);
    expect(CHUNK_ERROR_PATTERN.test("Network request failed")).toBe(false);
    expect(CHUNK_ERROR_PATTERN.test("ReferenceError: foo is not defined")).toBe(false);
    expect(CHUNK_ERROR_PATTERN.test("")).toBe(false);
  });
});
