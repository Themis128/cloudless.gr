import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/postiz", () => ({
  isPostizConfigured: vi.fn().mockResolvedValue(false),
  listPosts: vi.fn().mockResolvedValue([]),
  listPostizIntegrations: vi.fn().mockResolvedValue([]),
  matchIntegrationsForPlatform: vi.fn().mockReturnValue([]),
  schedulePost: vi.fn().mockResolvedValue({ ok: false }),
  withSocialUtm: vi.fn((url: string) => url),
}));

import { scheduleBlogShare, type BlogShareInput } from "@/lib/postiz-blog";

const baseInput: BlogShareInput = {
  pageId: "page-abc",
  title: "My Blog Post",
  excerpt: "A short description",
  url: "https://cloudless.gr/en/blog/my-post",
};

beforeEach(() => {
  delete process.env.AUTO_POST_BLOG_TO_SOCIAL;
});

describe("scheduleBlogShare", () => {
  it("returns feature_off when AUTO_POST_BLOG_TO_SOCIAL is not set", async () => {
    const result = await scheduleBlogShare(baseInput);
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe("feature_off");
    expect(result.postIds).toEqual([]);
  });

  it("returns feature_off when AUTO_POST_BLOG_TO_SOCIAL is 0", async () => {
    process.env.AUTO_POST_BLOG_TO_SOCIAL = "0";
    const result = await scheduleBlogShare(baseInput);
    expect(result.skipped).toBe("feature_off");
  });

  it("returns postiz_unconfigured when Postiz is not configured", async () => {
    process.env.AUTO_POST_BLOG_TO_SOCIAL = "1";
    const result = await scheduleBlogShare(baseInput);
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe("postiz_unconfigured");
  });
});
