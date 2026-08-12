import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetConfig, mockFetch } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));
vi.stubGlobal("fetch", mockFetch);

import {
  changePostStatus,
  createPost,
  deleteIntegration,
  deletePost,
  deletePostsByGroup,
  findSlot,
  getIntegrationAnalytics,
  getIntegrationConnectUrl,
  getIntegrationSettings,
  getPostMissingContent,
  getPostStats,
  isApiKeyValid,
  isPostizConfigured,
  listGroups,
  listIntegrations,
  listNotifications,
  listPostizIntegrations,
  listPosts,
  matchIntegrationsForPlatform,
  postIdentifier,
  POSTIZ_ALLOWED_UPLOAD_MIME,
  PostizApiError,
  PostizNotConfiguredError,
  schedulePost,
  triggerIntegrationTool,
  updatePost,
  updatePostReleaseId,
  uploadFile,
  uploadFromUrl,
  type PostizIntegration,
} from "@/lib/postiz";
import { verifyPostizWebhookSignature } from "@/lib/postiz-webhook";

const CONFIGURED = {
  POSTIZ_API_URL: "https://postiz.cloudless.gr/",
  POSTIZ_API_KEY: "pk_test_123",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfig.mockResolvedValue(CONFIGURED);
});

describe("isPostizConfigured", () => {
  it("is true when both URL and key are set", async () => {
    await expect(isPostizConfigured()).resolves.toBe(true);
  });

  it("is false when either value is missing", async () => {
    mockGetConfig.mockResolvedValue({ POSTIZ_API_URL: "", POSTIZ_API_KEY: "x" });
    await expect(isPostizConfigured()).resolves.toBe(false);
    mockGetConfig.mockResolvedValue({ POSTIZ_API_URL: "https://p", POSTIZ_API_KEY: "" });
    await expect(isPostizConfigured()).resolves.toBe(false);
  });
});

describe("listPostizIntegrations", () => {
  it("calls the public API with the API key and strips trailing slash", async () => {
    mockFetch.mockResolvedValue(jsonResponse([]));
    await listPostizIntegrations();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://postiz.cloudless.gr/api/public/v1/integrations");
    // postizFetch builds a Headers instance (CF Access can append via .set).
    expect(init.headers).toBeInstanceOf(Headers);
    expect(init.headers.get("Authorization")).toBe("pk_test_123");
  });

  it("supports both array and wrapped response shapes", async () => {
    const channels = [{ id: "1", name: "FB Page", identifier: "facebook" }];
    mockFetch.mockResolvedValueOnce(jsonResponse(channels));
    await expect(listPostizIntegrations()).resolves.toEqual(channels);
    mockFetch.mockResolvedValueOnce(jsonResponse({ integrations: channels }));
    await expect(listPostizIntegrations()).resolves.toEqual(channels);
  });

  it("returns [] on HTTP errors and network failures", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "nope" }, 401));
    await expect(listPostizIntegrations()).resolves.toEqual([]);
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(listPostizIntegrations()).resolves.toEqual([]);
  });
});

describe("matchIntegrationsForPlatform", () => {
  const channels: PostizIntegration[] = [
    { id: "fb", name: "Page", identifier: "facebook" },
    { id: "ig", name: "Insta", identifier: "instagram" },
    { id: "li", name: "Profile", identifier: "linkedin" },
    { id: "off", name: "Dead", identifier: "x", disabled: true },
  ];

  it("maps calendar 'meta' to facebook + instagram", () => {
    const result = matchIntegrationsForPlatform(channels, "meta");
    expect(result.map((r) => r.id).sort((a, b) => a.localeCompare(b))).toEqual(["fb", "ig"]);
  });

  it("excludes disabled channels", () => {
    expect(matchIntegrationsForPlatform(channels, "x")).toEqual([]);
  });

  it("returns [] for platforms without a Postiz mapping", () => {
    expect(matchIntegrationsForPlatform(channels, "activecampaign")).toEqual([]);
    expect(matchIntegrationsForPlatform(channels, "google")).toEqual([]);
  });
});

describe("schedulePost", () => {
  it("rejects empty targets and empty content without calling the API", async () => {
    const noTargets = await schedulePost({ content: "hello", integrationIds: [] });
    expect(noTargets.ok).toBe(false);
    const noContent = await schedulePost({ content: "   ", integrationIds: ["fb"] });
    expect(noContent.ok).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("uses type=schedule for future dates and type=now for past dates", async () => {
    mockFetch.mockImplementation(() => Promise.resolve(jsonResponse([{ id: "p1" }])));
    const future = new Date(Date.now() + 3600_000).toISOString();
    await schedulePost({ content: "hi", integrationIds: ["fb"], scheduleAt: future });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).type).toBe("schedule");

    const past = new Date(Date.now() - 3600_000).toISOString();
    await schedulePost({ content: "hi", integrationIds: ["fb"], scheduleAt: past });
    expect(JSON.parse(mockFetch.mock.calls[1][1].body).type).toBe("now");
  });

  it("uses type=draft when asDraft is set", async () => {
    mockFetch.mockImplementation(() => Promise.resolve(jsonResponse([{ id: "p1" }])));
    await schedulePost({ content: "hi", integrationIds: ["fb"], asDraft: true });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).type).toBe("draft");
  });

  it("builds one post entry per integration", async () => {
    mockFetch.mockResolvedValue(jsonResponse([{ id: "a" }, { id: "b" }]));
    const result = await schedulePost({ content: "hi", integrationIds: ["fb", "ig"] });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.posts).toHaveLength(2);
    expect(body.posts[0].integration.id).toBe("fb");
    expect(body.posts[0].value[0].content).toBe("hi");
    expect(result).toEqual({ ok: true, postIds: ["a", "b"] });
  });

  it("returns ok=false with the status on API rejection", async () => {
    mockFetch.mockResolvedValue(new Response("boom", { status: 422 }));
    const result = await schedulePost({ content: "hi", integrationIds: ["fb"] });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("422");
  });

  it("returns ok=false on network failure", async () => {
    mockFetch.mockRejectedValue(new Error("down"));
    const result = await schedulePost({ content: "hi", integrationIds: ["fb"] });
    expect(result.ok).toBe(false);
  });
});

// ------------------------------------------------------------------
// Admin-console surface (throwing variants used by /api/admin/postiz/*)
// ------------------------------------------------------------------

describe("listIntegrations (throwing)", () => {
  it("unwraps both bare-array and {integrations} shapes", async () => {
    const channels: PostizIntegration[] = [{ id: "1", name: "FB", identifier: "facebook" }];

    mockFetch.mockResolvedValueOnce(jsonResponse(channels));
    await expect(listIntegrations()).resolves.toEqual(channels);

    mockFetch.mockResolvedValueOnce(jsonResponse({ integrations: channels }));
    await expect(listIntegrations()).resolves.toEqual(channels);
  });

  it("throws PostizNotConfiguredError when SSM is empty", async () => {
    mockGetConfig.mockResolvedValue({ POSTIZ_API_URL: "", POSTIZ_API_KEY: "" });
    await expect(listIntegrations()).rejects.toBeInstanceOf(PostizNotConfiguredError);
  });

  it("throws PostizApiError on a non-OK response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401));
    await expect(listIntegrations()).rejects.toBeInstanceOf(PostizApiError);
  });
});

describe("listPosts (throwing)", () => {
  it("unwraps {posts} envelope returned by Postiz", async () => {
    const items = [
      {
        id: "p1",
        content: "hi",
        publishDate: "2026-06-16T10:00:00.000Z",
        state: "QUEUE",
        integration: { id: "fb", name: "FB", identifier: "facebook" },
      },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse({ posts: items }));
    await expect(listPosts("2026-06-01", "2026-06-30")).resolves.toEqual(items);
  });

  it("passes startDate and endDate as query params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ posts: [] }));
    await listPosts("2026-06-01", "2026-06-30");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("startDate=2026-06-01");
    expect(url).toContain("endDate=2026-06-30");
  });

  it("returns [] when Postiz returns an empty envelope", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await expect(listPosts("a", "b")).resolves.toEqual([]);
  });
});

describe("createPost (throwing)", () => {
  it("POSTs the body and returns the upstream array", async () => {
    const upstream = [{ postId: "p1", integration: "fb" }];
    mockFetch.mockResolvedValueOnce(jsonResponse(upstream));
    const result = await createPost({
      type: "now",
      date: "2026-06-16T10:00:00.000Z",
      shortLink: false,
      tags: [],
      posts: [
        {
          integration: { id: "fb" },
          value: [{ content: "hi", image: [] }],
          settings: { __type: "facebook" },
        },
      ],
    });
    expect(result).toEqual(upstream);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe("POST");
  });
});

describe("deletePost (throwing)", () => {
  it("issues DELETE on the post id with URL encoding", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await deletePost("abc/123");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/posts/abc%2F123");
    expect(init.method).toBe("DELETE");
  });

  it("swallows 404 (idempotent)", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "not found" }, 404));
    await expect(deletePost("p1")).resolves.toBeUndefined();
  });

  it("rethrows non-404 PostizApiError when body doesn't look like 'not found'", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));
    await expect(deletePost("p1")).rejects.toBeInstanceOf(PostizApiError);
  });

  it("swallows 500 only when body indicates not-found (docs known issue)", async () => {
    // Postiz docs note a known issue where a missing post id surfaces as a
    // 500. We swallow only those — anything else propagates.
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: "Post not found" }, 500));
    await expect(deletePost("p1")).resolves.toBeUndefined();
  });
});

describe("postIdentifier helper", () => {
  it("prefers providerIdentifier (docs shape) over identifier (legacy)", () => {
    expect(
      postIdentifier({
        integration: { id: "i", name: "n", providerIdentifier: "x", identifier: "stale" },
      })
    ).toBe("x");
  });

  it("falls back to identifier when providerIdentifier is missing", () => {
    expect(postIdentifier({ integration: { id: "i", name: "n", identifier: "facebook" } })).toBe(
      "facebook"
    );
  });

  it("returns empty string when neither field is set", () => {
    expect(postIdentifier({ integration: { id: "i", name: "n" } })).toBe("");
  });
});

describe("deletePostsByGroup", () => {
  it("DELETEs /posts/group/:group and URL-encodes the id", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "grp-1" }));
    await expect(deletePostsByGroup("grp/1")).resolves.toEqual({ id: "grp-1" });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/posts/group/grp%2F1");
    expect(init.method).toBe("DELETE");
  });
});

describe("changePostStatus", () => {
  it("PUTs /posts/:id/status with the status body and returns {id,state}", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "p1", state: "QUEUE" }));
    const result = await changePostStatus("p1", "schedule");
    expect(result).toEqual({ id: "p1", state: "QUEUE" });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/posts/p1/status");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ status: "schedule" });
  });
});

describe("getPostMissingContent", () => {
  it("GETs /posts/:id/missing-content", async () => {
    const items = [{ id: "x1", url: "https://x.com/post/1" }];
    mockFetch.mockResolvedValueOnce(jsonResponse(items));
    await expect(getPostMissingContent("p1")).resolves.toEqual(items);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/posts/p1/missing-content");
  });
});

describe("updatePostReleaseId", () => {
  it("PUTs /posts/:id/release-id with the new release id", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "p1", releaseId: "r1" }));
    const r = await updatePostReleaseId("p1", "r1");
    expect(r).toEqual({ id: "p1", releaseId: "r1" });
    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ releaseId: "r1" });
  });
});

describe("listGroups", () => {
  it("GETs /groups and returns the array", async () => {
    const groups = [{ id: "g1", name: "Acme" }];
    mockFetch.mockResolvedValueOnce(jsonResponse(groups));
    await expect(listGroups()).resolves.toEqual(groups);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/groups$/);
  });
});

describe("isApiKeyValid", () => {
  it("GETs /integrations/is-connected", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ connected: true }));
    await expect(isApiKeyValid()).resolves.toEqual({ connected: true });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/integrations/is-connected");
  });

  it("propagates 401 as PostizApiError so the admin route can map it", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "no" }, 401));
    await expect(isApiKeyValid()).rejects.toBeInstanceOf(PostizApiError);
  });
});

describe("deleteIntegration", () => {
  it("DELETEs /integrations/:id and URL-encodes", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteIntegration("i/1")).resolves.toBeUndefined();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/integrations/i%2F1");
    expect(init.method).toBe("DELETE");
  });
});

describe("getIntegrationConnectUrl", () => {
  it("GETs /integrations/:provider/connect", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ url: "https://oauth.example/start" }));
    await expect(getIntegrationConnectUrl("facebook")).resolves.toEqual({
      url: "https://oauth.example/start",
    });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/integrations/facebook/connect");
  });
});

describe("getIntegrationSettings", () => {
  it("GETs /integrations/:id/settings", async () => {
    const settings = { maxLength: 280, tools: ["search"] };
    mockFetch.mockResolvedValueOnce(jsonResponse(settings));
    await expect(getIntegrationSettings("int-1")).resolves.toEqual(settings);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/integrations/int-1/settings");
  });
});

describe("triggerIntegrationTool", () => {
  it("POSTs the tool body to /integrations/:id/trigger", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ items: ["a", "b"] }));
    await triggerIntegrationTool("int-1", { tool: "search-audio", data: { q: "lofi" } });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/integrations/int-1/trigger");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ tool: "search-audio", data: { q: "lofi" } });
  });
});

describe("listNotifications", () => {
  it("GETs /notifications with the page param", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await listNotifications(3);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/notifications?page=3");
  });

  it("defaults page=1", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await listNotifications();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/notifications?page=1");
  });
});

describe("getIntegrationAnalytics", () => {
  it("GETs /analytics/integration/:id with the date window", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await getIntegrationAnalytics("int-1", 30);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/analytics/integration/int-1");
    expect(url).toContain("date=30");
  });
});

describe("POSTIZ_ALLOWED_UPLOAD_MIME", () => {
  it("matches the documented allowlist exactly", () => {
    // docs.postiz.com /upload — jpeg, png, gif, webp, avif, bmp, tiff, mp4.
    expect([...POSTIZ_ALLOWED_UPLOAD_MIME].toSorted()).toEqual(
      [
        "image/avif",
        "image/bmp",
        "image/gif",
        "image/jpeg",
        "image/png",
        "image/tiff",
        "image/webp",
        "video/mp4",
      ].toSorted()
    );
  });
});

describe("uploadFromUrl (throwing)", () => {
  it("POSTs the source URL and returns the UploadedFile", async () => {
    const uploaded = { id: "u1", name: "", path: "https://cdn/u1.png", thumbnail: null, alt: null };
    mockFetch.mockResolvedValueOnce(jsonResponse(uploaded));
    await expect(uploadFromUrl("https://x.example/i.png")).resolves.toEqual(uploaded);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ url: "https://x.example/i.png" }));
    // 30s timeout — see uploadFromUrl docstring; a 10s default trips on
    // 5 MB+ source images.
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("findSlot (throwing)", () => {
  it("calls /find-slot/:id with the integration id URL-encoded", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ date: "2026-06-17T09:00:00.000Z" }));
    await findSlot("fb/page-1");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/find-slot/fb%2Fpage-1");
  });
});

describe("updatePost (throwing)", () => {
  it("PUTs the body to /posts/:id and returns the upstream array", async () => {
    const upstream = [{ postId: "p1", integration: "fb" }];
    mockFetch.mockResolvedValueOnce(jsonResponse(upstream));
    const result = await updatePost("p1", {
      type: "schedule",
      date: "2026-06-20T10:00:00.000Z",
      shortLink: false,
      tags: [],
      posts: [
        {
          integration: { id: "fb" },
          value: [{ content: "edited", image: [] }],
          settings: { __type: "facebook" },
        },
      ],
    });
    expect(result).toEqual(upstream);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/posts/p1");
    expect(init.method).toBe("PUT");
  });

  it("URL-encodes the id", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await updatePost("abc/123", {
      type: "draft",
      date: new Date().toISOString(),
      shortLink: false,
      tags: [],
      posts: [
        {
          integration: { id: "fb" },
          value: [{ content: "x", image: [] }],
          settings: { __type: "facebook" },
        },
      ],
    });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/posts/abc%2F123");
  });
});

describe("getPostStats (throwing)", () => {
  it("GETs /analytics/post/:id?date=<lookback> per docs.postiz.com", async () => {
    const stats = [
      { label: "Likes", data: [{ total: "150", date: "2026-06-15" }], percentageChange: 16.7 },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(stats));
    await expect(getPostStats("p1")).resolves.toEqual(stats);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/analytics/post/p1");
    expect(url).toContain("date=7");
  });

  it("honours a custom lookback window", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await getPostStats("p1", 30);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("date=30");
  });
});

describe("uploadFile (multipart)", () => {
  it("POSTs multipart/form-data with a `file` field and the API key header", async () => {
    const uploaded = {
      id: "u1",
      name: "x.png",
      path: "https://cdn/u1.png",
      thumbnail: null,
      alt: null,
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(uploaded));
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
    await expect(uploadFile(blob, "x.png")).resolves.toEqual(uploaded);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/public/v1/upload");
    expect(init.method).toBe("POST");
    // No JSON Content-Type — fetch sets the multipart boundary automatically.
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.headers.Authorization).toBe("pk_test_123");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("throws PostizApiError on an upstream non-OK", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "too big" }, 413));
    const blob = new Blob(["x"], { type: "image/png" });
    await expect(uploadFile(blob, "x.png")).rejects.toBeInstanceOf(PostizApiError);
  });
});

describe("verifyPostizWebhookSignature", () => {
  it("returns false when both signature header AND URL secret are missing", async () => {
    mockGetConfig.mockResolvedValue({
      POSTIZ_API_URL: "https://x",
      POSTIZ_API_KEY: "k",
      POSTIZ_WEBHOOK_SECRET: "secret",
    });
    await expect(verifyPostizWebhookSignature("body", null)).resolves.toBe(false);
    await expect(verifyPostizWebhookSignature("body", null, null)).resolves.toBe(false);
  });

  it("returns false when no secret is configured", async () => {
    mockGetConfig.mockResolvedValue({
      POSTIZ_API_URL: "https://x",
      POSTIZ_API_KEY: "k",
      POSTIZ_WEBHOOK_SECRET: "",
    });
    await expect(verifyPostizWebhookSignature("body", "abc")).resolves.toBe(false);
    await expect(verifyPostizWebhookSignature("body", null, "abc")).resolves.toBe(false);
  });

  it("returns true on a matching URL-secret query param", async () => {
    mockGetConfig.mockResolvedValue({
      POSTIZ_API_URL: "https://x",
      POSTIZ_API_KEY: "k",
      POSTIZ_WEBHOOK_SECRET: "exact-secret-value",
    });
    await expect(
      verifyPostizWebhookSignature("any-body", null, "exact-secret-value")
    ).resolves.toBe(true);
  });

  it("returns false on a wrong URL-secret query param", async () => {
    mockGetConfig.mockResolvedValue({
      POSTIZ_API_URL: "https://x",
      POSTIZ_API_KEY: "k",
      POSTIZ_WEBHOOK_SECRET: "exact-secret-value",
    });
    // Same length, different bytes — exercises the constant-time arm.
    await expect(verifyPostizWebhookSignature("body", null, "wrong-secret-value")).resolves.toBe(
      false
    );
    // Different length — exercises the length-prefilter.
    await expect(verifyPostizWebhookSignature("body", null, "short")).resolves.toBe(false);
  });

  it("returns true on a matching HMAC-SHA256 hex digest of the raw body", async () => {
    const { createHmac } = await import("node:crypto");
    const secret = "shhh";
    const body = '{"event":"post.published","post":{"id":"p1"}}';
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    mockGetConfig.mockResolvedValue({
      POSTIZ_API_URL: "https://x",
      POSTIZ_API_KEY: "k",
      POSTIZ_WEBHOOK_SECRET: secret,
    });
    await expect(verifyPostizWebhookSignature(body, sig)).resolves.toBe(true);
    // Also accepts the `sha256=` prefix variant.
    await expect(verifyPostizWebhookSignature(body, `sha256=${sig}`)).resolves.toBe(true);
    // And tolerates uppercase hex.
    await expect(verifyPostizWebhookSignature(body, sig.toUpperCase())).resolves.toBe(true);
  });

  it("returns false on tampered body (HMAC arm)", async () => {
    const { createHmac } = await import("node:crypto");
    const secret = "shhh";
    const sig = createHmac("sha256", secret).update("original").digest("hex");
    mockGetConfig.mockResolvedValue({
      POSTIZ_API_URL: "https://x",
      POSTIZ_API_KEY: "k",
      POSTIZ_WEBHOOK_SECRET: secret,
    });
    await expect(verifyPostizWebhookSignature("tampered", sig)).resolves.toBe(false);
  });

  it("accepts either arm — URL-secret wins even if signature is wrong", async () => {
    mockGetConfig.mockResolvedValue({
      POSTIZ_API_URL: "https://x",
      POSTIZ_API_KEY: "k",
      POSTIZ_WEBHOOK_SECRET: "shared",
    });
    await expect(
      verifyPostizWebhookSignature("body", "definitely-not-a-hash", "shared")
    ).resolves.toBe(true);
  });
});

describe("error class shapes", () => {
  it("PostizApiError exposes status and a truncated body", () => {
    const err = new PostizApiError(429, "rate limited and a long message ".repeat(20));
    expect(err.status).toBe(429);
    expect(err.body).toContain("rate limited");
    // Truncated to 200 chars in the message; the body field keeps the original.
    expect(err.message.length).toBeLessThan(250);
    expect(err.name).toBe("PostizApiError");
  });

  it("PostizNotConfiguredError keeps its name for instanceof routing", () => {
    const err = new PostizNotConfiguredError();
    expect(err.name).toBe("PostizNotConfiguredError");
    expect(err.message).toContain("not configured");
  });
});
