import { describe, it, expect, vi } from "vitest";

const mockListAllWorkspaces = vi.fn().mockResolvedValue([]);
const mockListAllViewsDeep = vi.fn().mockResolvedValue([]);
const mockGetDoc = vi.fn().mockResolvedValue(null);
const mockExtract = vi.fn().mockResolvedValue("");
vi.mock("@/lib/appflowy", () => ({
  fetchViewMarkdownMap: async (_ws: string, views: { view_id: string }[]) =>
    new Map(
      await Promise.all(
        views.map(async (v) => {
          try {
            return [v.view_id, await mockExtract(await mockGetDoc(_ws, v.view_id))] as const;
          } catch {
            return [v.view_id, null] as const;
          }
        })
      )
    ),
  isAppFlowyConfigured: vi.fn().mockResolvedValue(false),
  listWorkspaceViews: vi.fn().mockResolvedValue([]),
  listAllWorkspaces: (...a: unknown[]) => mockListAllWorkspaces(...a),
  listAllViewsDeep: (...a: unknown[]) => mockListAllViewsDeep(...a),
  getDocument: vi.fn().mockResolvedValue(null),
  extractDocText: vi.fn().mockResolvedValue(""),
  markdownToHtml: vi.fn().mockResolvedValue(""),
}));
vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn().mockResolvedValue({ APPFLOWY_API_URL: "" }),
}));

import {
  getPosts,
  getPostBySlug,
  getAllSlugs,
  getFeaturedPosts,
  getCategories,
  getTags,
  getPostsByCategory,
  getPostsByTag,
  searchPosts,
  getRelatedPosts,
} from "@/lib/appflowy-blog";

describe("appflowy-blog (AppFlowy not configured)", () => {
  it("getPosts returns []", async () => {
    expect(await getPosts()).toEqual([]);
  });

  it("getPostBySlug returns null", async () => {
    expect(await getPostBySlug("any-slug")).toBeNull();
  });

  it("getAllSlugs returns []", async () => {
    expect(await getAllSlugs()).toEqual([]);
  });

  it("getFeaturedPosts returns []", async () => {
    expect(await getFeaturedPosts()).toEqual([]);
  });

  it("getCategories returns []", async () => {
    expect(await getCategories()).toEqual([]);
  });

  it("getTags returns []", async () => {
    expect(await getTags()).toEqual([]);
  });

  it("getPostsByCategory returns []", async () => {
    expect(await getPostsByCategory("tech")).toEqual([]);
  });

  it("getPostsByTag returns []", async () => {
    expect(await getPostsByTag("cloud")).toEqual([]);
  });

  it("searchPosts returns []", async () => {
    expect(await searchPosts("query")).toEqual([]);
  });

  it("getRelatedPosts returns [] for any post", async () => {
    const fakePost = { id: "p1", slug: "test-post" } as Parameters<typeof getRelatedPosts>[0];
    expect(await getRelatedPosts(fakePost)).toEqual([]);
  });
});

describe("appflowy-blog tails (configured views)", () => {
  it("getRelatedPosts ranks same-category posts and slices to the limit", async () => {
    const appflowy = await import("@/lib/appflowy");
    const views = [
      { view_id: "a", name: "[Blog] Alpha Post", last_edited_time: "2026-10-01" },
      { view_id: "b", name: "[Blog] Beta Post", last_edited_time: "2026-10-02" },
    ];
    const orig = vi.mocked(appflowy.isAppFlowyConfigured);
    orig.mockResolvedValue(true);
    mockListAllWorkspaces.mockResolvedValue([{ workspace_id: "ws1" }]);
    mockListAllViewsDeep.mockResolvedValue(views);
    const { getPosts, getRelatedPosts } = await import("@/lib/appflowy-blog");
    const posts = await getPosts();
    const related = await getRelatedPosts(posts[0]);
    expect(related.length).toBe(1);
    expect(related[0].id).toBe("a");
    orig.mockResolvedValue(false);
  });
});
