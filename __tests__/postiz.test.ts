import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetConfig, mockFetch } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));
vi.stubGlobal("fetch", mockFetch);

import {
  createPost,
  deletePost,
  findSlot,
  isPostizConfigured,
  listIntegrations,
  listPostizIntegrations,
  listPosts,
  matchIntegrationsForPlatform,
  PostizApiError,
  PostizNotConfiguredError,
  schedulePost,
  uploadFromUrl,
  type PostizIntegration,
} from "@/lib/postiz";

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
    expect(init.headers.Authorization).toBe("pk_test_123");
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

  it("rethrows non-404 PostizApiError", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));
    await expect(deletePost("p1")).rejects.toBeInstanceOf(PostizApiError);
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
