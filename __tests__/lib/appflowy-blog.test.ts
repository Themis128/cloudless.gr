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
