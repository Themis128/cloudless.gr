import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetConfig, mockFetch } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));
vi.stubGlobal("fetch", mockFetch);

import {
  isPostizConfigured,
  listPostizIntegrations,
  matchIntegrationsForPlatform,
  schedulePost,
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
