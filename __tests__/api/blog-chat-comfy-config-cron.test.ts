/**
 * Tests for /api/blog, /api/chat-ai, /api/comfyui, /api/config,
 * /api/cron/{ad-analytics-poll,postiz-oauth-check}.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const auth = vi.hoisted(() => ({ ok: true }));
vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...actual,
    requireAdmin: vi.fn(async () =>
      auth.ok
        ? { ok: true, user: { id: "u1" } }
        : { ok: false, response: NextResponse.json({ error: "no" }, { status: 401 }) }
    ),
    requireAuth: vi.fn(async () =>
      auth.ok
        ? { ok: true, user: { id: "u1" } }
        : { ok: false, response: NextResponse.json({ error: "no" }, { status: 401 }) }
    ),
  };
});

const libs = vi.hoisted(() => ({
  getBlogPostsWithSource: vi.fn(),
  isAppFlowyConfigured: vi.fn(async () => true),
  normalizeAndValidatePrompt: vi.fn(),
  isCronAuthorized: vi.fn(async () => true),
  cronUnauthorized: vi.fn(
    () => new Response(JSON.stringify({ error: "unauth" }), { status: 401 })
  ),
  runScheduledPoll: vi.fn(),
  isPostizConfigured: vi.fn(),
  listIntegrations: vi.fn(),
  notifyOauthExpiry: vi.fn(async () => {}),
}));
vi.mock("@/lib/blog-source", () => ({
  getBlogPostsWithSource: libs.getBlogPostsWithSource,
}));
vi.mock("@/lib/appflowy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/appflowy")>();
  return { ...actual, isAppFlowyConfigured: libs.isAppFlowyConfigured };
});
vi.mock("@/lib/blog", () => ({
  posts: [{ slug: "static-1" }, { slug: "static-2" }, { slug: "static-3" }],
}));
vi.mock("@/lib/comfyui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/comfyui")>();
  return {
    ...actual,
    normalizeAndValidatePrompt: libs.normalizeAndValidatePrompt,
  };
});
vi.mock("@/lib/cron-auth", () => ({
  isCronAuthorized: libs.isCronAuthorized,
  cronUnauthorized: libs.cronUnauthorized,
}));
vi.mock("@/lib/ad-analytics/runtime", () => ({
  runScheduledPoll: libs.runScheduledPoll,
}));
vi.mock("@/lib/postiz", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/postiz")>();
  return {
    ...actual,
    isPostizConfigured: libs.isPostizConfigured,
    listIntegrations: libs.listIntegrations,
  };
});
vi.mock("@/lib/postiz-slack", () => ({
  notifyOauthExpiry: libs.notifyOauthExpiry,
}));

import { GET as blogGet } from "@/app/api/blog/route";
import { POST as chatPost } from "@/app/api/chat-ai/route";
import { POST as comfyPost } from "@/app/api/comfyui/route";
import { GET as configGet } from "@/app/api/config/route";
import { GET as adPollGet } from "@/app/api/cron/ad-analytics-poll/route";
import { GET as oauthCheckGet } from "@/app/api/cron/postiz-oauth-check/route";

const post = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  auth.ok = true;
  vi.stubGlobal("fetch", vi.fn());
});

describe("blog", () => {
  it("static when AppFlowy unbound; source-tagged list; limit; fallback on error", async () => {
    libs.isAppFlowyConfigured.mockResolvedValue(false);
    const res = await blogGet(new NextRequest("http://x/api/blog?limit=2"));
    expect(await res.json()).toEqual([
      { slug: "static-1" },
      { slug: "static-2" },
    ]);
    expect(res.headers.get("x-blog-source")).toBe("static");

    libs.isAppFlowyConfigured.mockResolvedValue(true);
    libs.getBlogPostsWithSource.mockResolvedValue({
      posts: [{ slug: "a" }, { slug: "b" }],
      source: "appflowy",
    });
    const res2 = await blogGet(new NextRequest("http://x/api/blog"));
    expect((await res2.json())).toHaveLength(2);
    expect(res2.headers.get("x-blog-source")).toBe("appflowy");

    libs.getBlogPostsWithSource.mockRejectedValue(new Error("af down"));
    const res3 = await blogGet(new NextRequest("http://x/api/blog"));
    expect((await res3.json())).toHaveLength(3);
    expect(res3.headers.get("x-blog-source")).toBe("static");
  });

  it("applies ?limit on the AppFlowy path and on the error-fallback path", async () => {
    libs.isAppFlowyConfigured.mockResolvedValue(true);
    libs.getBlogPostsWithSource.mockResolvedValue({
      posts: [{ slug: "a" }, { slug: "b" }, { slug: "c" }],
      source: "appflowy",
    });
    const res = await blogGet(new NextRequest("http://x/api/blog?limit=1"));
    expect(await res.json()).toEqual([{ slug: "a" }]);

    libs.getBlogPostsWithSource.mockRejectedValue(new Error("af down"));
    const res2 = await blogGet(new NextRequest("http://x/api/blog?limit=1"));
    expect((await res2.json())).toHaveLength(1);
    expect(res2.headers.get("x-blog-source")).toBe("static");
  });
});

describe("chat-ai", () => {
  it("401 anon; 400 empty; gemini relay; workers-ai 400; 500 on failure", async () => {
    auth.ok = false;
    expect(
      (await chatPost(post("http://x/api/chat-ai", { messages: [] }))).status
    ).toBe(401);
    auth.ok = true;

    expect(
      (
        await chatPost(post("http://x/api/chat-ai", { messages: [] }))
      ).status
    ).toBe(400);

    process.env.GEMINI_API_KEY = "gk";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "hi there" }] } }],
      }),
    } as Response);
    const j = await (
      await chatPost(
        post("http://x/api/chat-ai", {
          messages: [
            { role: "user", content: "hello" },
            { role: "assistant", content: "hi" },
          ],
        })
      )
    ).json();
    expect(j).toEqual({ response: "hi there", model: "gemini-2.5-flash" });
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as { body: string }).body
    );
    expect(body.contents[1].role).toBe("model");

    expect(
      (
        await chatPost(
          post("http://x/api/chat-ai", {
            messages: [{ role: "user", content: "x" }],
            provider: "workers-ai",
          })
        )
      ).status
    ).toBe(400);

    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);
    expect(
      (
        await chatPost(
          post("http://x/api/chat-ai", {
            messages: [{ role: "user", content: "x" }],
          })
        )
      ).status
    ).toBe(500);
    delete process.env.GEMINI_API_KEY;
  });
});

describe("comfyui", () => {
  it("rejects bad client_id; forwards to ComfyUI; maps errors", async () => {
    libs.normalizeAndValidatePrompt.mockReturnValue({
      client_id: "not-cloudless",
    });
    expect(
      (await comfyPost(post("http://x/api/comfyui", {}))).status
    ).toBe(400);

    libs.normalizeAndValidatePrompt.mockReturnValue({
      client_id: "cloudless-factory-7",
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ prompt_id: "p1" }),
    } as Response);
    const j = await (
      await comfyPost(post("http://x/api/comfyui", { prompt: {} }))
    ).json();
    expect(j).toEqual({ success: true, data: { prompt_id: "p1" } });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "http://host.docker.internal:8000/prompt"
    );

    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 502 } as Response);
    const res = await comfyPost(post("http://x/api/comfyui", { prompt: {} }));
    expect(res.status).toBe(500);
    expect((await res.json()).details).toContain("502");
  });
});

describe("config", () => {
  it("returns config without auth in non-production Node env", async () => {
    // covers isWorkersEnvironment() — caches undefined here
    vi.stubEnv("NODE_ENV", "test");
    const res = await configGet(new NextRequest("http://x/api/config"));
    expect(res.status).toBe(200);
  });


  it("prod-auth gate; key lookup; masked secrets; full config", async () => {
    const prevEnv = process.env.NODE_ENV;
    const saved: Record<string, string | undefined> = {};
    for (const k of [
      "CONFIG_API_KEY",
      "STRIPE_SECRET_KEY",
      "AUTH_SECRET",
      "GSC_SITE_URL",
    ]) {
      saved[k] = process.env[k];
    }
    process.env.CONFIG_API_KEY = "cfgkey";
    process.env.STRIPE_SECRET_KEY = "sk_live_x";
    process.env.AUTH_SECRET = "supersecret";
    process.env.GSC_SITE_URL = "sc-domain:cloudless.gr";
    vi.stubEnv("NODE_ENV", "production");

    // unauth'd
    expect((await configGet(new NextRequest("http://x/api/config"))).status).toBe(
      401
    );
    expect(
      (
        await configGet(
          new NextRequest("http://x/api/config", {
            headers: { "x-config-auth": "wrong" },
          })
        )
      ).status
    ).toBe(401);

    const authed = (q = "") =>
      configGet(
        new NextRequest(`http://x/api/config${q}`, {
          headers: { "x-config-auth": "cfgkey" },
        })
      );

    const j = await (await authed("?key=STRIPE_SECRET_KEY")).json();
    expect(j).toEqual({ key: "STRIPE_SECRET_KEY", value: "sk_live_x" });

    const j2 = await (await authed("?key=NOPE")).json();
    expect(j2.value).toBeNull();

    const j3 = await (await authed()).json();
    expect(j3.config.AUTH_SECRET).toBe("***");
    expect(j3.config.STRIPE_SECRET_KEY).toBe("sk_live_x");
    expect(j3.config.GSC_SITE_URL).toBe("sc-domain:cloudless.gr");

    vi.stubEnv("NODE_ENV", prevEnv ?? "test");
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
});

describe("cron routes", () => {
  it("ad-analytics-poll: 401 unauth'd, report, 500 on crash", async () => {
    libs.isCronAuthorized.mockResolvedValue(false);
    expect(
      (await adPollGet(new NextRequest("http://x/api/cron/ad-analytics-poll")))
        .status
    ).toBe(401);

    libs.isCronAuthorized.mockResolvedValue(true);
    libs.runScheduledPoll.mockResolvedValue({ campaigns: 2, posted: 1 });
    const j = await (
      await adPollGet(new NextRequest("http://x/api/cron/ad-analytics-poll"))
    ).json();
    expect(j).toEqual({ ok: true, campaigns: 2, posted: 1 });

    libs.runScheduledPoll.mockRejectedValue(new Error("poll crash"));
    expect(
      (await adPollGet(new NextRequest("http://x/api/cron/ad-analytics-poll")))
        .status
    ).toBe(500);
  });

  it("postiz-oauth-check: 401/503/502; alerts disabled channels", async () => {
    libs.isCronAuthorized.mockResolvedValue(false);
    expect(
      (await oauthCheckGet(new NextRequest("http://x/api/cron/postiz-oauth-check")))
        .status
    ).toBe(401);

    libs.isCronAuthorized.mockResolvedValue(true);
    libs.isPostizConfigured.mockResolvedValue(false);
    expect(
      (await oauthCheckGet(new NextRequest("http://x/api/cron/postiz-oauth-check")))
        .status
    ).toBe(503);

    libs.isPostizConfigured.mockResolvedValue(true);
    libs.listIntegrations.mockRejectedValue(new Error("postiz 502"));
    expect(
      (await oauthCheckGet(new NextRequest("http://x/api/cron/postiz-oauth-check")))
        .status
    ).toBe(502);

    libs.listIntegrations.mockResolvedValue([
      { id: "1", name: "LI", identifier: "@li", disabled: false },
      { id: "2", name: "X", identifier: "@x", disabled: true },
    ]);
    const j = await (
      await oauthCheckGet(
        new NextRequest("http://x/api/cron/postiz-oauth-check")
      )
    ).json();
    expect(j).toEqual({
      ok: true,
      total: 2,
      disabled: 1,
      notified: [{ id: "2", name: "X", identifier: "@x" }],
    });
    expect(libs.notifyOauthExpiry).toHaveBeenCalledWith(
      expect.objectContaining({ id: "2" })
    );

    // notify failure doesn't fail the run
    libs.notifyOauthExpiry.mockRejectedValueOnce(new Error("slack down"));
    const res = await oauthCheckGet(
      new NextRequest("http://x/api/cron/postiz-oauth-check")
    );
    expect(res.status).toBe(200);
  });
});
