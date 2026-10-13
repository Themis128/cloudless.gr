/**
 * Tests for POST /api/admin/ai/generate, GET /api/admin/ai/status and
 * POST /api/admin/ai/rag/sync.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const apiAuth = vi.hoisted(() => ({ ok: true }));
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () =>
    apiAuth.ok
      ? { ok: true, user: { id: "u1" } }
      : { ok: false, response: NextResponse.json({ error: "no" }, { status: 401 }) }
  ),
}));

const libs = vi.hoisted(() => ({
  getAdminAiUsageSnapshot: vi.fn(),
  isAdminAiConfiguredAsync: vi.fn(),
  isAdminVectorizeConfigured: vi.fn(),
  syncAppFlowyToVectorize: vi.fn(),
  isEspoQueueConfigured: vi.fn(),
  isTurnstileConfigured: vi.fn(),
  getTurnstileSiteKey: vi.fn(),
}));
vi.mock("@/lib/admin-ai-usage", () => ({
  getAdminAiUsageSnapshot: libs.getAdminAiUsageSnapshot,
}));
vi.mock("@/lib/admin-ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-ai")>();
  return { ...actual, isAdminAiConfiguredAsync: libs.isAdminAiConfiguredAsync };
});
vi.mock("@/lib/admin-vectorize", () => ({
  isAdminVectorizeConfigured: libs.isAdminVectorizeConfigured,
  syncAppFlowyToVectorize: libs.syncAppFlowyToVectorize,
}));
vi.mock("@/lib/espocrm-queue", () => ({
  isEspoQueueConfigured: libs.isEspoQueueConfigured,
}));
vi.mock("@/lib/turnstile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/turnstile")>();
  return {
    ...actual,
    isTurnstileConfigured: libs.isTurnstileConfigured,
    getTurnstileSiteKey: libs.getTurnstileSiteKey,
  };
});

import { POST as generatePost } from "@/app/api/admin/ai/generate/route";
import { GET as statusGet } from "@/app/api/admin/ai/status/route";
import { POST as ragSync } from "@/app/api/admin/ai/rag/sync/route";

const post = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const GENERATE = "http://localhost/api/admin/ai/generate";
const STATUS = "http://localhost/api/admin/ai/status";
const SYNC = "http://localhost/api/admin/ai/rag/sync";

describe("POST /api/admin/ai/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuth.ok = true;
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("401s non-admin; validates JSON + prompt", async () => {
    apiAuth.ok = false;
    expect((await generatePost(post(GENERATE, {}))).status).toBe(401);
    apiAuth.ok = true;

    expect((await generatePost(post(GENERATE, "{bad"))).status).toBe(400);
    expect((await generatePost(post(GENERATE, {}))).status).toBe(400);
    expect((await generatePost(post(GENERATE, { prompt: "  " }))).status).toBe(
      400
    );
  });

  it("503s without CF env; model falls back to default", async () => {
    vi.unstubAllEnvs();
    expect((await generatePost(post(GENERATE, { prompt: "hi" }))).status).toBe(
      503
    );
  });

  it("proxies to Workers AI and returns usage", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: { response: "hello", input_tokens: 5, output_tokens: 7 },
      }),
    } as Response);
    const j = await (
      await generatePost(
        post(GENERATE, { prompt: "hi", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" })
      )
    ).json();
    expect(j).toEqual({
      success: true,
      result: "hello",
      model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      usage: { inputTokens: 5, outputTokens: 7 },
    });
    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain("accounts/acct/ai/run/@cf/meta/llama-3.3-70b");

    // disallowed model → default
    await generatePost(post(GENERATE, { prompt: "hi", model: "evil/model" }));
    expect(vi.mocked(fetch).mock.calls[1][0] as string).toContain(
      "llama-3.1-8b-instruct-fast"
    );
  });

  it("maps CF errors: 5xx→502, 4xx passthrough, 500 on fetch throw", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ errors: [{ message: "upstream" }] }),
    } as Response);
    const res = await generatePost(post(GENERATE, { prompt: "hi" }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("upstream");

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
    } as Response);
    const res2 = await generatePost(post(GENERATE, { prompt: "hi" }));
    expect(res2.status).toBe(400);
    expect((await res2.json()).error).toContain("Unknown error");

    vi.mocked(fetch).mockRejectedValue(new Error("net"));
    expect((await generatePost(post(GENERATE, { prompt: "hi" }))).status).toBe(
      500
    );
  });
});

describe("GET /api/admin/ai/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuth.ok = true;
    libs.getAdminAiUsageSnapshot.mockReturnValue({ calls: 3 });
    libs.isAdminAiConfiguredAsync.mockResolvedValue(true);
    libs.isAdminVectorizeConfigured.mockReturnValue(true);
    libs.isEspoQueueConfigured.mockReturnValue(false);
    libs.isTurnstileConfigured.mockReturnValue(true);
    libs.getTurnstileSiteKey.mockReturnValue("site-key");
  });

  it("401s non-admin; aggregates config flags", async () => {
    apiAuth.ok = false;
    expect((await statusGet(new NextRequest(STATUS))).status).toBe(401);
    apiAuth.ok = true;

    const j = await (await statusGet(new NextRequest(STATUS))).json();
    expect(j).toEqual({
      configured: true,
      usage: { calls: 3 },
      vectorize: { configured: true },
      turnstile: { configured: true, siteKeyPresent: true },
      espocrmQueue: { configured: false },
    });
  });
});

describe("POST /api/admin/ai/rag/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuth.ok = true;
    libs.isAdminVectorizeConfigured.mockReturnValue(true);
    libs.syncAppFlowyToVectorize.mockResolvedValue({ synced: 12 });
  });

  it("401s non-admin; 503s unconfigured; syncs and forwards errors", async () => {
    apiAuth.ok = false;
    expect((await ragSync(post(SYNC, {}))).status).toBe(401);
    apiAuth.ok = true;

    libs.isAdminVectorizeConfigured.mockReturnValue(false);
    expect((await ragSync(post(SYNC, {}))).status).toBe(503);
    libs.isAdminVectorizeConfigured.mockReturnValue(true);

    const j = await (await ragSync(post(SYNC, {}))).json();
    expect(j).toEqual({ ok: true, synced: 12 });

    libs.syncAppFlowyToVectorize.mockRejectedValue(new Error("boom"));
    const j2 = await (await ragSync(post(SYNC, {}))).json();
    expect(j2.error).toBe("boom");

    libs.syncAppFlowyToVectorize.mockRejectedValue("nope");
    const j3 = await (await ragSync(post(SYNC, {}))).json();
    expect(j3.error).toBe("RAG sync failed");
  });
});
