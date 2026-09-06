import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: vi.fn().mockResolvedValue(false),
  listWorkspaceViews: vi.fn().mockResolvedValue([]),
  getDocument: vi.fn().mockResolvedValue(null),
  extractDocText: vi.fn().mockResolvedValue(""),
  markdownToHtml: vi.fn().mockResolvedValue(""),
}));
vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn().mockResolvedValue({ APPFLOWY_API_URL: "" }),
}));

import {
  parseAppFlowyDocCategory,
  getDocs,
  getDocBySlug,
  searchDocs,
  groupDocsByCategory,
  getDocContentWithToc,
} from "@/lib/appflowy-docs";

describe("parseAppFlowyDocCategory", () => {
  it("parses 'Category / Title' format", () => {
    const result = parseAppFlowyDocCategory("Getting Started / Installation Guide");
    expect(result.category).toBe("Getting Started");
    expect(result.title).toBe("Installation Guide");
  });

  it("returns the full name as title when there is no separator", () => {
    const result = parseAppFlowyDocCategory("SimplePage");
    expect(result.title).toBe("SimplePage");
    expect(result.category).toBeTruthy();
  });
});

describe("appflowy-docs (AppFlowy not configured)", () => {
  it("getDocs returns []", async () => {
    expect(await getDocs()).toEqual([]);
  });

  it("getDocBySlug returns null", async () => {
    expect(await getDocBySlug("any-slug")).toBeNull();
  });

  it("searchDocs returns []", async () => {
    expect(await searchDocs("query")).toEqual([]);
  });

  it("groupDocsByCategory returns empty object", async () => {
    const result = await groupDocsByCategory();
    expect(typeof result).toBe("object");
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("getDocContentWithToc returns empty html and toc when not configured", async () => {
    const result = await getDocContentWithToc("any-id");
    expect(result.html).toBe("");
    expect(Array.isArray(result.toc)).toBe(true);
    expect(result.toc).toHaveLength(0);
  });
});
