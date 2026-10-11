import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockGetConfig, mockFetch, mockRequireAdmin } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockFetch: vi.fn(),
  mockRequireAdmin: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));
vi.mock("@/lib/api-auth", () => ({ requireAdmin: mockRequireAdmin }));
vi.stubGlobal("fetch", mockFetch);

const CONFIGURED = {
  SOCIALAUTO_API_URL: "https://social.cloudless.gr",
  SOCIALAUTO_ADMIN_EMAIL: "admin@example.com",
  SOCIALAUTO_ADMIN_PASSWORD: "pw",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeJwt(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString("base64url");
  return `x.${payload}.y`;
}

function mockLoginThen(...responses: Response[]) {
  mockFetch.mockResolvedValueOnce(jsonResponse({ access_token: fakeJwt() }));
  for (const r of responses) mockFetch.mockResolvedValueOnce(r);
}

async function loadLib() {
  return await import("@/lib/socialauto");
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  mockFetch.mockReset(); // flush leftover mockResolvedValueOnce queue
  mockGetConfig.mockResolvedValue(CONFIGURED);
  mockRequireAdmin.mockResolvedValue({ ok: true });
});

const ACCOUNT = {
  id: "a1", platform: "instagram", account_id: "ig-1",
  username: "cloudless.gr", display_name: "Cloudless",
  avatar_url: "https://x/pic.png", status: "active",
};

describe("accounts → integrations", () => {
  it("lists accounts and maps to PostizIntegration", async () => {
    mockLoginThen(jsonResponse([ACCOUNT]));
    const { listAccountsAsIntegrations } = await loadLib();
    const out = await listAccountsAsIntegrations();
    expect(out[0]).toMatchObject({
      id: "a1", name: "Cloudless", identifier: "instagram",
      picture: "https://x/pic.png", disabled: false,
    });
  });

  it("falls back to username, marks non-active disabled", async () => {
    mockLoginThen(jsonResponse([
      { ...ACCOUNT, display_name: null, status: "revoked" },
    ]));
    const { listAccounts, listAccountsAsIntegrations } = await loadLib();
    expect((await listAccounts())[0].status).toBe("revoked");

    mockFetch.mockResolvedValueOnce(jsonResponse([
      { ...ACCOUNT, display_name: null, status: "revoked" },
    ]));
    const out = await listAccountsAsIntegrations(); // token cached — no login
    expect(out[0].name).toBe("cloudless.gr");
    expect(out[0].disabled).toBe(true);
  });
});

describe("listPostsInWindow", () => {
  const post = (over: Record<string, unknown>) => ({
    id: "p1", status: "published", content_text: "hello",
    scheduled_at: null, published_at: "2026-10-10T12:00:00Z",
    created_at: "2026-10-01T00:00:00Z", media_ids: [],
    targets: [
      { social_account_id: "a1", platform: "instagram", username: "ig",
        status: "done", platform_url: "https://ig/p/1" },
      { social_account_id: "a2", platform: "threads", username: null,
        status: "done", platform_url: null },
    ],
    ...over,
  });

  function mockAllPosts(lists: Record<string, unknown[]>) {
    mockFetch.mockResolvedValueOnce(jsonResponse({ access_token: fakeJwt() }));
    for (const s of ["scheduled", "published", "failed", "draft",
                     "approved", "review", "publishing"]) {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ posts: lists[s] ?? [], total: 0 }));
    }
  }

  it("explodes posts per target, maps states, sorts by date", async () => {
    mockAllPosts({
      published: [post({}), post({ id: "p2", status: "weird",
                                  published_at: "2026-10-09T00:00:00Z", targets: [] })],
      failed: [post({ id: "p3", status: "failed",
                     published_at: "2026-10-11T00:00:00Z", targets: [] })],
    });
    const { listPostsInWindow } = await loadLib();
    const out = await listPostsInWindow("2026-10-01", "2026-10-12");
    // p2 (no targets) + p1 (2 targets) + p3 (no targets) = 4 rows
    expect(out).toHaveLength(4);
    expect(out[0].state).toBe("DRAFT"); // unknown status → DRAFT
    const pub = out.filter((r) => r.id === "p1");
    expect(pub).toHaveLength(2);
    expect(pub[0].releaseURL).toBe("https://ig/p/1");
    expect(pub[1].integration.name).toBe("threads"); // username null → platform
    const orphan = out.find((r) => r.id === "p3");
    expect(orphan?.state).toBe("ERROR");
    expect(orphan?.integration.name).toBe("(no channel)");
  });

  it("drops posts outside the window and tolerates per-status failures", async () => {
    // one status errors → catch returns empty list for it
    mockFetch.mockResolvedValueOnce(jsonResponse({ access_token: fakeJwt() }));
    mockFetch.mockRejectedValueOnce(new Error("net down"));
    for (const _s of ["published", "failed", "draft", "approved",
                      "review", "publishing"]) {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ posts: [
          { ...post({}), published_at: "2026-12-31T00:00:00Z", targets: [] },
        ] }));
    }
    const { listPostsInWindow } = await loadLib();
    const out = await listPostsInWindow("2026-10-01", "2026-10-12");
    expect(out).toHaveLength(0); // all Dec 31, outside window
  });
});

describe("create / update / delete posts", () => {
  const body = {
    type: "schedule",
    date: "2026-10-12T09:00:00Z",
    posts: [{
      integration: { id: "a1" },
      value: [{ content: "hi", image: [{ id: "m1" }] }],
    }],
  };

  it("creates a scheduled post from the Postiz body", async () => {
    mockLoginThen(jsonResponse({ id: "p9" }));
    const { createPostFromBody } = await loadLib();
    const out = await createPostFromBody(body as never);
    expect(out).toEqual([{ postId: "p9", integration: "a1" }]);
    const [, init] = mockFetch.mock.calls[1] as [string, RequestInit];
    const sent = JSON.parse(String(init.body));
    expect(sent.scheduled_at).toBe(body.date);
    expect(sent.media_ids).toEqual(["m1"]);
    expect(sent.target_account_ids).toEqual(["a1"]);
  });

  it("type=now also calls publish-now", async () => {
    mockLoginThen(jsonResponse({ id: "p9" }), jsonResponse({ id: "p9" }));
    const { createPostFromBody } = await loadLib();
    await createPostFromBody({ ...body, type: "now" } as never);
    const [url] = mockFetch.mock.calls[2] as [string];
    expect(url).toContain("/content/posts/p9/publish-now");
  });

  it("type=now publish failure propagates", async () => {
    mockLoginThen(jsonResponse({ id: "p9" }),
                  jsonResponse({ detail: "no media" }, 422));
    const { createPostFromBody } = await loadLib();
    await expect(
      createPostFromBody({ ...body, type: "now" } as never)
    ).rejects.toThrow("422");
  });

  it("type=draft posts with null scheduled_at", async () => {
    mockLoginThen(jsonResponse({ id: "p9" }));
    const { createPostFromBody } = await loadLib();
    await createPostFromBody({ ...body, type: "draft" } as never);
    const [, init] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).scheduled_at).toBeNull();
  });

  it("updatePostFromBody PATCHes the post", async () => {
    mockLoginThen(jsonResponse({ id: "p9" }));
    const { updatePostFromBody } = await loadLib();
    const out = await updatePostFromBody("p9", body as never);
    expect(out).toEqual([{ postId: "p9", integration: "a1" }]);
    const [url, init] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("/content/posts/p9");
    expect(init.method).toBe("PATCH");
  });

  it("deletePostById swallows 404, rethrows other errors", async () => {
    mockLoginThen(jsonResponse({}, 404));
    const { deletePostById } = await loadLib();
    await expect(deletePostById("gone")).resolves.toBeUndefined();

    // token still cached — second call needs only the upstream response
    mockFetch.mockResolvedValueOnce(jsonResponse({ detail: "x" }, 500));
    await expect(deletePostById("p")).rejects.toThrow("500");
  });
});

describe("media upload", () => {
  it("uploads multipart and returns UploadedFile", async () => {
    mockLoginThen(jsonResponse({
      id: "m1", filename: null, storage_path: "s/m1.png",
      public_url: "https://cdn/m1.png",
    }));
    const { uploadFileToSocialAuto } = await loadLib();
    const out = await uploadFileToSocialAuto(new Blob(["x"]), "orig.png");
    expect(out).toEqual({ id: "m1", name: "orig.png", path: "https://cdn/m1.png" });
    const [, init] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("falls back to storage_path without public_url", async () => {
    mockLoginThen(jsonResponse({
      id: "m1", filename: "f.png", storage_path: "s/f.png", public_url: null,
    }));
    const { uploadFileToSocialAuto } = await loadLib();
    expect((await uploadFileToSocialAuto(new Blob(["x"]), "f.png")).path).toBe("s/f.png");
  });

  it("uploadFromUrl fetches bytes then uploads", async () => {
    // source fetch (no auth) — fake Response so blob() stays in the jsdom realm
    mockFetch
      .mockResolvedValueOnce({
        ok: true, status: 200,
        blob: async () => new Blob(["imgbytes"]),
      } as Response)
      .mockResolvedValueOnce(jsonResponse({ access_token: fakeJwt() }))
      .mockResolvedValueOnce(jsonResponse({ id: "m", filename: "x.png",
                                            storage_path: "p", public_url: null }));
    const { uploadFromUrlToSocialAuto } = await loadLib();
    const out = await uploadFromUrlToSocialAuto("https://cdn.example/x.png?v=2");
    expect(out.name).toBe("x.png");
  });

  it("uploadFromUrl rejects on source fetch failure", async () => {
    mockFetch.mockResolvedValueOnce(new Response("nf", { status: 404 }));
    const { uploadFromUrlToSocialAuto } = await loadLib();
    await expect(
      uploadFromUrlToSocialAuto("https://cdn.example/gone.png")
    ).rejects.toThrow("404");
  });
});

describe("analytics + ops helpers", () => {
  it("maps account metrics to PostizAnalyticsMetric shape", async () => {
    mockLoginThen(jsonResponse({
      account_id: "a1", platform: "instagram", username: "ig",
      followers: 120, posts_count: 9, total_impressions: 5000,
      total_engagement: 321, avg_engagement_rate: 6.421,
      impressions_change_pct: 12.5,
    }));
    const { getChannelAnalytics } = await loadLib();
    const metrics = await getChannelAnalytics("a1", 30);
    expect(metrics).toHaveLength(5);
    expect(metrics[0].label).toBe("Followers");
    expect(metrics[0].data[0].total).toBe("120");
    expect(metrics[1].percentageChange).toBe(12.5);
    expect(metrics[4].data[0].total).toBe("6.42"); // rounded
  });

  it("socialautoAdsControl maps to /linkedin/ads-control", async () => {
    mockLoginThen(jsonResponse({ ok: true }));
    const { socialautoAdsControl } = await loadLib();
    expect(await socialautoAdsControl("pause")).toEqual({ ok: true });
    const [url, init] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("/linkedin/ads-control");
    expect(JSON.parse(String(init.body)).action).toBe("pause");
  });

  it("socialautoAdsControl returns error shape on failure", async () => {
    mockLoginThen(jsonResponse({}, 500));
    const { socialautoAdsControl } = await loadLib();
    const out = await socialautoAdsControl("status");
    expect(out.ok).toBe(false);
    expect(out.error).toContain("500");
  });

  it("retry/cancel queue items hit /publishing/queue endpoints", async () => {
    mockLoginThen(jsonResponse({}));
    const { retryQueueItem } = await loadLib();
    expect(await retryQueueItem("q1")).toEqual({ ok: true });
    expect((mockFetch.mock.calls[1] as [string])[0]).toContain(
      "/publishing/queue/q1/retry");

    mockLoginThen(jsonResponse({}));
    const { cancelQueueItem } = await loadLib();
    expect(await cancelQueueItem("q2")).toEqual({ ok: true });
    expect((mockFetch.mock.calls[2] as [string])[0]).toContain(
      "/publishing/queue/q2/cancel");
  });

  it("queue item errors return detail body", async () => {
    mockLoginThen(jsonResponse({}, 409));
    const { retryQueueItem } = await loadLib();
    const out = await retryQueueItem("q");
    expect(out.ok).toBe(false);
  });

  it("nextSlot returns top of next hour", async () => {
    const { nextSlot } = await loadLib();
    const d = new Date(nextSlot("i1").date);
    expect(d.getMinutes()).toBe(0);
    expect(d.getTime()).toBeGreaterThan(Date.now());
  });

  it("isSocialAutoConfigured reflects config state", async () => {
    const { isSocialAutoConfigured } = await loadLib();
    expect(await isSocialAutoConfigured()).toBe(true);
    mockGetConfig.mockResolvedValue({});
    vi.resetModules();
    const lib2 = await import("@/lib/socialauto");
    expect(await lib2.isSocialAutoConfigured()).toBe(false);
  });
});

describe("auth/token internals", () => {
  it("401 invalidates cached token and retries once", async () => {
    // login → call 401 → login again → call 200
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ access_token: fakeJwt() }))
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ access_token: fakeJwt() }))
      .mockResolvedValueOnce(jsonResponse([ACCOUNT]));
    const { listAccounts } = await loadLib();
    const out = await listAccounts();
    expect(out).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect((mockFetch.mock.calls[0] as [string])[0]).toContain("/auth/login");
    expect((mockFetch.mock.calls[2] as [string])[0]).toContain("/auth/login");
  });

  it("adds CF Access service-token headers when configured", async () => {
    mockGetConfig.mockResolvedValue({
      ...CONFIGURED, SOCIALAUTO_SERVICE_TOKEN: "cid:csec",
    });
    mockLoginThen(jsonResponse([ACCOUNT]));
    const { listAccounts } = await loadLib();
    await listAccounts();
    const [, init] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect((init.headers as Headers).get("Cf-Access-Client-Id")).toBe("cid");
    expect((init.headers as Headers).get("Cf-Access-Client-Secret")).toBe("csec");
  });

  it("login failure throws SocialAutoApiError", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ detail: "denied" }, 403));
    const { listAccounts } = await loadLib();
    await expect(listAccounts()).rejects.toThrow("SocialAuto API error 403");
  });

  it("non-JSON login body surfaces as missing-token error", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("<html>cf access</html>", { status: 200 }));
    const { listAccounts } = await loadLib();
    await expect(listAccounts()).rejects.toThrow("access_token");
  });

  it("unconfigured throws SocialAutoNotConfiguredError", async () => {
    mockGetConfig.mockResolvedValue({});
    const { listAccounts } = await loadLib();
    await expect(listAccounts()).rejects.toThrow("not configured");
  });
});

describe("shared route helpers", () => {
  it("createBodyInvalidDetail / invalidCreateBodyResponse", async () => {
    const { createBodyInvalidDetail, invalidCreateBodyResponse } = await loadLib();
    expect(createBodyInvalidDetail(null)).toBe("type and posts[] are required");
    expect(createBodyInvalidDetail({ type: "draft", posts: [] } as never))
      .toBe("type and posts[] are required");
    expect(createBodyInvalidDetail({ type: "draft", posts: [{}] } as never))
      .toBeNull();
    const res = invalidCreateBodyResponse(null);
    expect(res?.status).toBe(400);
    expect(invalidCreateBodyResponse({ type: "draft", posts: [{}] } as never))
      .toBeNull();
  });

  it("readJsonBody returns 400 response on bad JSON", async () => {
    const { readJsonBody } = await loadLib();
    const req = new NextRequest("https://x/api", {
      method: "POST", body: "{bad json",
      headers: { "Content-Type": "application/json" },
    });
    const out = await readJsonBody(req);
    expect(out).toBeInstanceOf(NextResponse);
    expect((out as NextResponse).status).toBe(400);

    const good = new NextRequest("https://x/api", {
      method: "POST", body: JSON.stringify({ a: 1 }),
      headers: { "Content-Type": "application/json" },
    });
    expect(await readJsonBody(good)).toEqual({ a: 1 });
  });

  it("saErrorToResponse maps error classes", async () => {
    const { saErrorToResponse, SocialAutoApiError,
            SocialAutoNotConfiguredError } = await loadLib();
    expect(saErrorToResponse(new SocialAutoNotConfiguredError()).status).toBe(503);
    expect(saErrorToResponse(new SocialAutoApiError(429, "slow")).status).toBe(429);
    expect(saErrorToResponse(new SocialAutoApiError(500, "x")).status).toBe(502);
    expect(() => saErrorToResponse(new Error("other"))).toThrow("other");
  });

  it("saAdminRoute enforces admin + maps errors", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    });
    const { saAdminRoute, SocialAutoApiError } = await loadLib();
    const handler = saAdminRoute(async () =>
      NextResponse.json({ ok: true }));
    const res = await handler(
      new NextRequest("https://x"), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);

    mockRequireAdmin.mockResolvedValue({ ok: true });
    const throwing = saAdminRoute(async () => {
      throw new SocialAutoApiError(500, "boom");
    });
    const res2 = await throwing(
      new NextRequest("https://x"), { params: Promise.resolve({}) });
    expect(res2.status).toBe(502);
  });
});
