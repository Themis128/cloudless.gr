import { describe, it, expect, vi } from "vitest";

const { mockIsMeili } = vi.hoisted(() => ({ mockIsMeili: vi.fn().mockReturnValue(false) }));

vi.mock("@/lib/meilisearch", () => ({
  isMeilisearchConfigured: mockIsMeili,
  meiliRequest: vi.fn(),
  getMeiliAdminKey: vi.fn().mockReturnValue(""),
  getMeiliSearchKey: vi.fn().mockReturnValue(""),
}));

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/appflowy-blog", () => ({
  getPosts: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/appflowy-docs", () => ({
  getDocs: vi.fn().mockResolvedValue([]),
}));

import { CONTENT_INDEX, syncContentIndex, searchContent } from "@/lib/content-index";

describe("CONTENT_INDEX", () => {
  it("is the expected index name", () => {
    expect(CONTENT_INDEX).toBe("site-content");
  });
});

describe("syncContentIndex (meilisearch not configured)", () => {
  it("returns configured=false immediately", async () => {
    const result = await syncContentIndex();
    expect(result.configured).toBe(false);
    expect(result.indexed).toBe(0);
    expect(result.sources.blog).toBe(0);
    expect(result.sources.docs).toBe(0);
  });
});

describe("searchContent (meilisearch not configured)", () => {
  it("returns empty array", async () => {
    const results = await searchContent("cloud");
    expect(results).toEqual([]);
  });

  it("returns empty array for empty query", async () => {
    const results = await searchContent("  ");
    expect(results).toEqual([]);
  });
});
