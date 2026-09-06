/**
 * Tests for src/lib/admin-rag.ts
 *
 * Covers:
 *  - retrieveAdminRagContext() — empty query, no hits, hits, import failure
 */
import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock the dynamic import of admin-vectorize
// ---------------------------------------------------------------------------
vi.mock("@/lib/admin-vectorize", () => ({
  queryAdminVectorize: vi.fn(),
}));

import { retrieveAdminRagContext } from "@/lib/admin-rag";
import { queryAdminVectorize } from "@/lib/admin-vectorize";

const mockQuery = vi.mocked(queryAdminVectorize);

// ---------------------------------------------------------------------------
describe("retrieveAdminRagContext", () => {
  it("returns empty string for empty query", async () => {
    const result = await retrieveAdminRagContext("");
    expect(result).toBe("");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns empty string for whitespace-only query", async () => {
    const result = await retrieveAdminRagContext("   ");
    expect(result).toBe("");
  });

  it("returns empty string when no hits found", async () => {
    mockQuery.mockResolvedValue([]);
    const result = await retrieveAdminRagContext("find me something");
    expect(result).toBe("");
  });

  it("formats hits as numbered list with source and title", async () => {
    mockQuery.mockResolvedValue([
      { source: "blog", title: "How to deploy", text: "Use k3s on a Pi", id: "1", score: 0.9 },
      { source: "docs", title: "Auth setup", text: "Use D1 database", id: "2", score: 0.8 },
    ]);
    const result = await retrieveAdminRagContext("deployment guide");
    expect(result).toContain("[1] (blog) How to deploy");
    expect(result).toContain("Use k3s on a Pi");
    expect(result).toContain("[2] (docs) Auth setup");
    expect(result).toContain("Use D1 database");
  });

  it("calls queryAdminVectorize with topK=5", async () => {
    mockQuery.mockResolvedValue([]);
    await retrieveAdminRagContext("some query");
    expect(mockQuery).toHaveBeenCalledWith("some query", { topK: 5 });
  });

  it("returns empty string when dynamic import throws", async () => {
    mockQuery.mockRejectedValue(new Error("vectorize not bound"));
    const result = await retrieveAdminRagContext("something");
    expect(result).toBe("");
  });
});
