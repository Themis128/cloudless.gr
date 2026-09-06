/**
 * Tests for src/lib/appflowy-search.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockIsConfigured,
  mockListWorkspaces,
  mockListViewsDeep,
  mockGetDocument,
  mockExtractDocText,
  mockSearchDocuments,
} = vi.hoisted(() => ({
  mockIsConfigured: vi.fn(),
  mockListWorkspaces: vi.fn(),
  mockListViewsDeep: vi.fn(),
  mockGetDocument: vi.fn(),
  mockExtractDocText: vi.fn(),
  mockSearchDocuments: vi.fn(),
}));

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: mockIsConfigured,
  listAllWorkspaces: mockListWorkspaces,
  listAllViewsDeep: mockListViewsDeep,
  getDocument: mockGetDocument,
  extractDocText: mockExtractDocText,
  searchDocuments: mockSearchDocuments,
}));

import {
  searchPages,
  searchDatabases,
  listUsers,
  getDatabaseSchema,
} from "@/lib/appflowy-search";

beforeEach(() => {
  mockIsConfigured.mockReset().mockResolvedValue(true);
  mockListWorkspaces.mockReset().mockResolvedValue([{ workspace_id: "ws-1" }]);
  mockListViewsDeep.mockReset().mockResolvedValue([]);
  mockGetDocument.mockReset().mockResolvedValue({});
  mockExtractDocText.mockReset().mockResolvedValue("document text");
  mockSearchDocuments.mockReset().mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("searchPages", () => {
  it("returns empty array when AppFlowy is not configured", async () => {
    mockIsConfigured.mockResolvedValue(false);
    expect(await searchPages("query")).toEqual([]);
  });

  it("returns empty array for empty query", async () => {
    expect(await searchPages("")).toEqual([]);
    expect(await searchPages("   ")).toEqual([]);
  });

  it("returns empty array when no workspaces found", async () => {
    mockListWorkspaces.mockResolvedValue([]);
    expect(await searchPages("hello")).toEqual([]);
  });

  it("returns empty array when search returns no views", async () => {
    mockSearchDocuments.mockResolvedValue([]);
    expect(await searchPages("test")).toEqual([]);
  });

  it("returns mapped results from search", async () => {
    mockSearchDocuments.mockResolvedValue([
      { view_id: "v1", name: "My Page", type: "document", last_edited_time: "2026-09-01" },
    ]);
    mockExtractDocText.mockResolvedValue("Some content here");
    const results = await searchPages("my page");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("v1");
    expect(results[0].title).toBe("My Page");
    expect(results[0].type).toBe("page");
    expect(results[0].excerpt).toContain("Some content");
  });

  it("maps folder type as database", async () => {
    mockSearchDocuments.mockResolvedValue([
      { view_id: "v2", name: "Folder A", type: "folder", last_edited_time: "2026-09-01" },
    ]);
    const results = await searchPages("folder");
    expect(results[0].type).toBe("database");
  });

  it("truncates excerpt to 200 chars and adds ellipsis", async () => {
    const longText = "a".repeat(300);
    mockSearchDocuments.mockResolvedValue([
      { view_id: "v3", name: "Long Page", type: "document", last_edited_time: "" },
    ]);
    mockExtractDocText.mockResolvedValue(longText);
    const results = await searchPages("long");
    expect(results[0].excerpt.endsWith("...")).toBe(true);
    expect(results[0].excerpt.length).toBeLessThanOrEqual(203);
  });

  it("skips results when getDocument fails", async () => {
    mockSearchDocuments.mockResolvedValue([
      { view_id: "v4", name: "Bad Page", type: "document", last_edited_time: "" },
    ]);
    mockGetDocument.mockRejectedValue(new Error("Not found"));
    expect(await searchPages("bad")).toEqual([]);
  });

  it("returns empty array on outer error", async () => {
    mockListWorkspaces.mockRejectedValue(new Error("API down"));
    expect(await searchPages("test")).toEqual([]);
  });

  it("respects limit parameter", async () => {
    const views = Array.from({ length: 30 }, (_, i) => ({
      view_id: `v${i}`,
      name: `Page ${i}`,
      type: "document",
      last_edited_time: "",
    }));
    mockSearchDocuments.mockResolvedValue(views);
    const results = await searchPages("page", 5);
    expect(results).toHaveLength(5);
  });
});

describe("searchDatabases", () => {
  it("returns empty array when not configured", async () => {
    mockIsConfigured.mockResolvedValue(false);
    expect(await searchDatabases("query")).toEqual([]);
  });

  it("returns empty array for empty query", async () => {
    expect(await searchDatabases("  ")).toEqual([]);
  });

  it("returns empty array when no workspaces", async () => {
    mockListWorkspaces.mockResolvedValue([]);
    expect(await searchDatabases("test")).toEqual([]);
  });

  it("filters to folder views matching query", async () => {
    mockListViewsDeep.mockResolvedValue([
      { view_id: "f1", name: "Content Database", type: "folder", last_edited_time: "2026-09-01" },
      { view_id: "p1", name: "My Page", type: "document", last_edited_time: "2026-09-01" },
      { view_id: "f2", name: "Other Folder", type: "folder", last_edited_time: "2026-09-01" },
    ]);
    const results = await searchDatabases("content");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("f1");
    expect(results[0].type).toBe("database");
  });

  it("returns empty array on error", async () => {
    mockListViewsDeep.mockRejectedValue(new Error("fail"));
    expect(await searchDatabases("test")).toEqual([]);
  });
});

describe("listUsers", () => {
  it("returns empty array when not configured", async () => {
    mockIsConfigured.mockResolvedValue(false);
    expect(await listUsers()).toEqual([]);
  });

  it("returns empty array when configured (no API)", async () => {
    expect(await listUsers()).toEqual([]);
  });
});

describe("getDatabaseSchema", () => {
  it("returns null (AppFlowy has no schema concept)", async () => {
    expect(await getDatabaseSchema("db-1")).toBeNull();
  });
});
