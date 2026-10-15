/**
 * postiz-blog.ts — real scheduleBlogShare against the real postiz.ts client;
 * only the network boundary (fetch) and SSM config are stubbed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockGetConfig } = vi.hoisted(() => ({ mockGetConfig: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));

import { scheduleBlogShare } from "@/lib/postiz-blog";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const CONFIGURED = {
  POSTIZ_API_URL: "https://postiz.cloudless.gr/",
  POSTIZ_API_KEY: "pk_test",
};

const INPUT = {
  pageId: "page-1234567890",
  title: "New post",
  excerpt: "Excerpt.",
  url: "https://cloudless.gr/en/blog/new-post",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Real client flow: GET /posts (idempotency) → GET /integrations → POST /posts. */
function queueHappyPath(integrations: unknown[]) {
  mockFetch
    .mockResolvedValueOnce(jsonResponse({ posts: [] })) // listPosts idempotency check
    .mockResolvedValueOnce(jsonResponse(integrations)) // listPostizIntegrations
    .mockImplementation((url: unknown) => {
      // schedulePost's own integration list + the /posts write
      if (String(url).includes("/integrations")) {
        return Promise.resolve(jsonResponse(integrations));
      }
      return Promise.resolve(jsonResponse([{ id: "p1" }]));
    });
}

function lastPostizPostBody(): Record<string, unknown> {
  const call = [...mockFetch.mock.calls]
    .reverse()
    .find(([url]) => String(url).includes("/posts") && !String(url).includes("?"));
  return JSON.parse(String(call?.[1]?.body ?? "{}"));
}

beforeEach(() => {
  vi.stubEnv("AUTO_POST_BLOG_TO_SOCIAL", "1");
  mockFetch.mockReset();
  mockGetConfig.mockResolvedValue(CONFIGURED);
});

afterEach(() => vi.unstubAllEnvs());

describe("scheduleBlogShare — real postiz.ts client", () => {
  it("tiktok platform → real utm_source=tiktok in scheduled content", async () => {
    queueHappyPath([{ id: "tt1", name: "TT", identifier: "tiktok" }]);
    const r = await scheduleBlogShare({ ...INPUT, platforms: ["tiktok"] });
    expect(r.ok).toBe(true);
    const body = lastPostizPostBody() as {
      posts: Array<{ value: Array<{ content: string }> }>;
    };
    expect(body.posts[0].value[0].content).toContain("utm_source=tiktok");
  });

  it("meta platform → utm_source=facebook via the real mapper", async () => {
    queueHappyPath([{ id: "fb1", name: "FB", identifier: "facebook" }]);
    await scheduleBlogShare({ ...INPUT, platforms: ["meta"] });
    const body = lastPostizPostBody() as {
      posts: Array<{ value: Array<{ content: string }> }>;
    };
    expect(body.posts[0].value[0].content).toContain("utm_source=facebook");
  });

  it("linkedin → utm_source=linkedin and real linkedin settings in the post body", async () => {
    queueHappyPath([{ id: "li1", name: "LI", identifier: "linkedin" }]);
    await scheduleBlogShare({ ...INPUT, platforms: ["linkedin"] });
    const body = lastPostizPostBody() as {
      posts: Array<{ value: Array<{ content: string }>; settings: Record<string, unknown> }>;
    };
    expect(body.posts[0].value[0].content).toContain("utm_source=linkedin");
    expect(body.posts[0].settings).toMatchObject({
      __type: "linkedin",
      post_as_images_carousel: false,
    });
  });

  it("returns no_channels when no integration matches the platform", async () => {
    queueHappyPath([{ id: "li1", name: "LI", identifier: "linkedin" }]);
    const r = await scheduleBlogShare({ ...INPUT, platforms: ["tiktok"] });
    expect(r).toMatchObject({ ok: false, skipped: "no_channels" });
  });

  it("skips when the real listPosts shows the idempotency tag", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ posts: [{ id: "old", content: "x blog-page-1234567890 x" }] })
    );
    const r = await scheduleBlogShare({ ...INPUT, platforms: ["linkedin"] });
    expect(r).toMatchObject({ ok: true, skipped: "already_posted" });
    const postWrites = mockFetch.mock.calls.filter(
      ([u, i]) => String(u).includes("/posts") && i?.method === "POST"
    );
    expect(postWrites).toHaveLength(0);
  });

  it("feature flag off → skipped without touching Postiz", async () => {
    vi.stubEnv("AUTO_POST_BLOG_TO_SOCIAL", "0");
    const r = await scheduleBlogShare(INPUT);
    expect(r).toMatchObject({ ok: true, skipped: "feature_off" });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
