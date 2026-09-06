/**
 * Tests for src/lib/postiz-blog.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockIsPostizConfigured,
  mockListPosts,
  mockListIntegrations,
  mockMatchIntegrations,
  mockSchedulePost,
  mockWithSocialUtm,
} = vi.hoisted(() => ({
  mockIsPostizConfigured: vi.fn(),
  mockListPosts: vi.fn(),
  mockListIntegrations: vi.fn(),
  mockMatchIntegrations: vi.fn(),
  mockSchedulePost: vi.fn(),
  mockWithSocialUtm: vi.fn((url: string) => url),
}));

vi.mock("@/lib/postiz", () => ({
  isPostizConfigured: mockIsPostizConfigured,
  listPosts: mockListPosts,
  listPostizIntegrations: mockListIntegrations,
  matchIntegrationsForPlatform: mockMatchIntegrations,
  schedulePost: mockSchedulePost,
  withSocialUtm: mockWithSocialUtm,
}));

import { scheduleBlogShare } from "@/lib/postiz-blog";

const BASE_INPUT = {
  pageId: "page-abc",
  title: "My Post",
  excerpt: "A short excerpt",
  url: "https://cloudless.gr/blog/my-post",
};

beforeEach(() => {
  mockIsPostizConfigured.mockReset();
  mockListPosts.mockReset().mockResolvedValue([]);
  mockListIntegrations.mockReset().mockResolvedValue([]);
  mockMatchIntegrations.mockReset().mockReturnValue([]);
  mockSchedulePost.mockReset().mockResolvedValue({ ok: true, postIds: ["post-1"] });
  mockWithSocialUtm.mockReset().mockImplementation((url: string) => url);
  delete process.env.AUTO_POST_BLOG_TO_SOCIAL;
});

describe("scheduleBlogShare", () => {
  it("returns feature_off when AUTO_POST_BLOG_TO_SOCIAL is not set", async () => {
    const result = await scheduleBlogShare(BASE_INPUT);
    expect(result.skipped).toBe("feature_off");
    expect(result.ok).toBe(true);
    expect(result.postIds).toEqual([]);
    expect(mockIsPostizConfigured).not.toHaveBeenCalled();
  });

  it("returns postiz_unconfigured when Postiz is not configured", async () => {
    process.env.AUTO_POST_BLOG_TO_SOCIAL = "1";
    mockIsPostizConfigured.mockResolvedValue(false);
    const result = await scheduleBlogShare(BASE_INPUT);
    expect(result.skipped).toBe("postiz_unconfigured");
    expect(result.ok).toBe(false);
  });

  it("returns already_posted when a recent post contains the idempotency tag", async () => {
    process.env.AUTO_POST_BLOG_TO_SOCIAL = "1";
    mockIsPostizConfigured.mockResolvedValue(true);
    mockListPosts.mockResolvedValue([{ content: "blog-page-abc" }]);
    const result = await scheduleBlogShare(BASE_INPUT);
    expect(result.skipped).toBe("already_posted");
    expect(result.ok).toBe(true);
  });

  it("returns no_channels when no integrations match any platform", async () => {
    process.env.AUTO_POST_BLOG_TO_SOCIAL = "1";
    mockIsPostizConfigured.mockResolvedValue(true);
    mockMatchIntegrations.mockReturnValue([]);
    const result = await scheduleBlogShare(BASE_INPUT);
    expect(result.skipped).toBe("no_channels");
    expect(result.ok).toBe(false);
  });

  it("schedules posts for each platform that has integrations", async () => {
    process.env.AUTO_POST_BLOG_TO_SOCIAL = "1";
    mockIsPostizConfigured.mockResolvedValue(true);
    mockMatchIntegrations.mockImplementation((_, platform: string) =>
      platform === "linkedin" ? [{ id: "li-1" }] : []
    );
    mockSchedulePost.mockResolvedValue({ ok: true, postIds: ["p-1"] });
    const result = await scheduleBlogShare(BASE_INPUT);
    expect(result.ok).toBe(true);
    expect(result.postIds).toContain("p-1");
  });

  it("accumulates post ids from multiple platforms", async () => {
    process.env.AUTO_POST_BLOG_TO_SOCIAL = "1";
    mockIsPostizConfigured.mockResolvedValue(true);
    mockMatchIntegrations.mockImplementation((_, platform: string) => {
      if (platform === "linkedin") return [{ id: "li-1" }];
      if (platform === "x") return [{ id: "x-1" }];
      return [];
    });
    let call = 0;
    mockSchedulePost.mockImplementation(() => {
      call++;
      return Promise.resolve({ ok: true, postIds: [`post-${call}`] });
    });
    const result = await scheduleBlogShare(BASE_INPUT);
    expect(result.postIds).toHaveLength(2);
  });

  it("uses custom platforms when provided", async () => {
    process.env.AUTO_POST_BLOG_TO_SOCIAL = "1";
    mockIsPostizConfigured.mockResolvedValue(true);
    mockMatchIntegrations.mockReturnValue([{ id: "li-1" }]);
    mockSchedulePost.mockResolvedValue({ ok: true, postIds: ["p1"] });
    const result = await scheduleBlogShare({ ...BASE_INPUT, platforms: ["linkedin"] });
    // Only called once since we specified only linkedin
    expect(mockMatchIntegrations).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });

  it("still proceeds when listPosts throws (idempotency check fails)", async () => {
    process.env.AUTO_POST_BLOG_TO_SOCIAL = "1";
    mockIsPostizConfigured.mockResolvedValue(true);
    mockListPosts.mockRejectedValue(new Error("Postiz unavailable"));
    mockMatchIntegrations.mockReturnValue([{ id: "li-1" }]);
    mockSchedulePost.mockResolvedValue({ ok: true, postIds: ["p-1"] });
    const result = await scheduleBlogShare(BASE_INPUT);
    expect(result.ok).toBe(true);
    expect(result.postIds).toContain("p-1");
  });

  it("returns error when schedulePost fails for all channels", async () => {
    process.env.AUTO_POST_BLOG_TO_SOCIAL = "1";
    mockIsPostizConfigured.mockResolvedValue(true);
    mockMatchIntegrations.mockReturnValue([{ id: "li-1" }]);
    mockSchedulePost.mockResolvedValue({ ok: false, postIds: [], error: "API error" });
    const result = await scheduleBlogShare({ ...BASE_INPUT, platforms: ["linkedin"] });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("API error");
  });

  it("includes idempotency tag in schedulePost call", async () => {
    process.env.AUTO_POST_BLOG_TO_SOCIAL = "1";
    mockIsPostizConfigured.mockResolvedValue(true);
    mockMatchIntegrations.mockReturnValue([{ id: "li-1" }]);
    mockSchedulePost.mockResolvedValue({ ok: true, postIds: ["p1"] });
    await scheduleBlogShare({ ...BASE_INPUT, platforms: ["linkedin"] });
    const [scheduleArgs] = mockSchedulePost.mock.calls[0];
    expect(scheduleArgs.tags).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: "blog-page-abc" })])
    );
  });
});
