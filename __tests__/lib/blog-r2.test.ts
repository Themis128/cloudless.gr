/**
 * Tests for src/lib/blog-r2.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetDataLakeBucketFromEnv } = vi.hoisted(() => ({
  mockGetDataLakeBucketFromEnv: vi.fn(),
}));

vi.mock("@/lib/r2-client", () => ({
  getDataLakeBucketFromEnv: mockGetDataLakeBucketFromEnv,
}));

import { getR2BlogPosts, getR2BlogPostBySlug } from "@/lib/blog-r2";

function makeR2Item(data: object) {
  return { text: () => Promise.resolve(JSON.stringify(data)) };
}

function makeBucket(
  listResult: { objects: { key: string }[] },
  getResult: object | null | "error"
) {
  const mockGet = vi.fn().mockImplementation(() => {
    if (getResult === "error") throw new Error("R2 error");
    if (getResult === null) return Promise.resolve(null);
    return Promise.resolve(makeR2Item(getResult));
  });
  const mockList = vi.fn().mockResolvedValue(listResult);
  return { list: mockList, get: mockGet };
}

beforeEach(() => {
  mockGetDataLakeBucketFromEnv.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const SAMPLE_POST = {
  slug: "my-post",
  title: "My Post",
  excerpt: "Excerpt",
  date: "2026-09-01",
  readTime: "3 min",
  category: "Cloud",
  content: "Body text",
  html: "<p>Body text</p>",
};

describe("getR2BlogPosts", () => {
  it("returns empty array when bucket is not configured", async () => {
    mockGetDataLakeBucketFromEnv.mockReturnValue(null);
    expect(await getR2BlogPosts()).toEqual([]);
  });

  it("returns empty array when bucket.list returns no objects", async () => {
    mockGetDataLakeBucketFromEnv.mockReturnValue(makeBucket({ objects: [] }, null));
    expect(await getR2BlogPosts()).toEqual([]);
  });

  it("returns parsed blog posts from R2 objects", async () => {
    const bucket = {
      list: vi.fn().mockResolvedValue({ objects: [{ key: "newsletter/articles/my-post.json" }] }),
      get: vi.fn().mockResolvedValue(makeR2Item(SAMPLE_POST)),
    };
    mockGetDataLakeBucketFromEnv.mockReturnValue(bucket);
    const posts = await getR2BlogPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].slug).toBe("my-post");
    expect(posts[0].title).toBe("My Post");
  });

  it("skips objects where bucket.get returns null", async () => {
    const bucket = {
      list: vi.fn().mockResolvedValue({ objects: [{ key: "newsletter/articles/missing.json" }] }),
      get: vi.fn().mockResolvedValue(null),
    };
    mockGetDataLakeBucketFromEnv.mockReturnValue(bucket);
    expect(await getR2BlogPosts()).toEqual([]);
  });

  it("sorts posts by date descending", async () => {
    const older = { ...SAMPLE_POST, slug: "old", date: "2026-08-01" };
    const newer = { ...SAMPLE_POST, slug: "new", date: "2026-09-05" };
    const bucket = {
      list: vi.fn().mockResolvedValue({ objects: [{ key: "a" }, { key: "b" }] }),
      get: vi.fn()
        .mockResolvedValueOnce(makeR2Item(older))
        .mockResolvedValueOnce(makeR2Item(newer)),
    };
    mockGetDataLakeBucketFromEnv.mockReturnValue(bucket);
    const posts = await getR2BlogPosts();
    expect(posts[0].slug).toBe("new");
    expect(posts[1].slug).toBe("old");
  });

  it("returns empty array on list error", async () => {
    const bucket = {
      list: vi.fn().mockRejectedValue(new Error("R2 down")),
      get: vi.fn(),
    };
    mockGetDataLakeBucketFromEnv.mockReturnValue(bucket);
    expect(await getR2BlogPosts()).toEqual([]);
  });
});

describe("getR2BlogPostBySlug", () => {
  it("returns undefined when bucket is not configured", async () => {
    mockGetDataLakeBucketFromEnv.mockReturnValue(null);
    expect(await getR2BlogPostBySlug("my-post")).toBeUndefined();
  });

  it("returns undefined when object is not found", async () => {
    const bucket = { get: vi.fn().mockResolvedValue(null) };
    mockGetDataLakeBucketFromEnv.mockReturnValue(bucket);
    expect(await getR2BlogPostBySlug("missing")).toBeUndefined();
  });

  it("returns parsed post when object exists", async () => {
    const bucket = { get: vi.fn().mockResolvedValue(makeR2Item(SAMPLE_POST)) };
    mockGetDataLakeBucketFromEnv.mockReturnValue(bucket);
    const post = await getR2BlogPostBySlug("my-post");
    expect(post?.slug).toBe("my-post");
    expect(post?.title).toBe("My Post");
  });

  it("fetches with correct key path", async () => {
    const mockGet = vi.fn().mockResolvedValue(makeR2Item(SAMPLE_POST));
    mockGetDataLakeBucketFromEnv.mockReturnValue({ get: mockGet });
    await getR2BlogPostBySlug("my-post");
    expect(mockGet).toHaveBeenCalledWith("newsletter/articles/my-post.json");
  });

  it("returns undefined on fetch error", async () => {
    const bucket = { get: vi.fn().mockRejectedValue(new Error("R2 error")) };
    mockGetDataLakeBucketFromEnv.mockReturnValue(bucket);
    expect(await getR2BlogPostBySlug("error-post")).toBeUndefined();
  });
});
