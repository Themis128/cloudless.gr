/**
 * Postiz AI proxy — Playwright E2E tests
 *
 * Two surfaces:
 *   1. The Cloudflare Worker (postiz-ai-proxy) directly — model list, auth,
 *      chat completions model-swap, image gen 501.
 *   2. The app's /api/admin/postiz routes — confirm they still respond after
 *      the OPENAI_BASE_URL env change on the Postiz pod.
 *
 * Worker tests use full URLs (no base URL) so they run against the live Worker
 * regardless of where the dev server is pointed.
 */

import { test, expect } from "@playwright/test";
import { ADMIN_TOKEN, api } from "./_helpers";

const WORKER = "https://postiz-ai-proxy.baltzakis-themis.workers.dev";
const PROXY_TOKEN = "69d8f49bc06ada482c44134ea3caae10329b2a2b1a83372db637a3b94eb8fa19";
const authHeaders = { authorization: `Bearer ${ADMIN_TOKEN}` };

// ── 1. Worker: unauthenticated paths ─────────────────────────────────────────

test.describe("postiz-ai-proxy Worker — public", () => {
  test("GET /v1/models returns synthetic model list (no auth required)", async ({ request }) => {
    const res = await request.get(`${WORKER}/v1/models`);
    expect(res.status()).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.object).toBe("list");
    const data = body.data as Array<{ id: string }>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].id).toContain("llama-3.3-70b");
  });

  test("OPTIONS /v1/chat/completions returns CORS headers", async ({ request }) => {
    const res = await request.fetch(`${WORKER}/v1/chat/completions`, { method: "OPTIONS" });
    expect(res.status()).toBe(204);
    expect(res.headers()["access-control-allow-methods"]).toContain("POST");
  });
});

// ── 2. Worker: model swap ─────────────────────────────────────────────────────

test.describe("postiz-ai-proxy Worker — model swap", () => {
  test("POST /v1/chat/completions swaps gpt-4.1 → llama-3.3-70b and returns a completion", async ({ request }) => {
    const res = await request.post(`${WORKER}/v1/chat/completions`, {
      headers: {
        Authorization: `Bearer ${PROXY_TOKEN}`,
        "Content-Type": "application/json",
      },
      // Postiz hardcodes "gpt-4.1" — the Worker must swap it
      data: {
        model: "gpt-4.1",
        messages: [
          { role: "user", content: "Reply with exactly one word: cloud" },
        ],
        max_tokens: 10,
        temperature: 0,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    // Confirm the upstream model used is llama, not gpt-4.1
    expect(body.model as string).toContain("llama-3.3-70b");
    const choices = body.choices as Array<{ message: { content: string } }>;
    expect(choices.length).toBeGreaterThan(0);
    expect(typeof choices[0].message.content).toBe("string");
    expect(choices[0].message.content.length).toBeGreaterThan(0);
  });

  test("POST /v1/chat/completions with invalid JSON returns 400", async ({ request }) => {
    const res = await request.post(`${WORKER}/v1/chat/completions`, {
      headers: {
        Authorization: `Bearer ${PROXY_TOKEN}`,
        "Content-Type": "application/json",
      },
      data: "not-json",
    });
    expect(res.status()).toBe(400);
  });
});

// ── 4. Worker: image gen 501 ──────────────────────────────────────────────────

test.describe("postiz-ai-proxy Worker — image gen", () => {
  test("POST /v1/images/generations returns 501 (no DALL-E on NVIDIA)", async ({ request }) => {
    const res = await request.post(`${WORKER}/v1/images/generations`, {
      headers: {
        Authorization: `Bearer ${PROXY_TOKEN}`,
        "Content-Type": "application/json",
      },
      data: { prompt: "a cat", n: 1, size: "1024x1024" },
    });
    expect(res.status()).toBe(501);
    const body = await res.json() as Record<string, unknown>;
    expect((body.error as Record<string, unknown>).type).toBe("not_implemented");
  });
});

// ── 5. Worker: unknown routes ─────────────────────────────────────────────────

test.describe("postiz-ai-proxy Worker — routing", () => {
  test("unknown path returns 404", async ({ request }) => {
    const res = await request.get(`${WORKER}/v1/unknown`);
    expect(res.status()).toBe(404);
  });
});

// ── 6. App: admin Postiz routes still healthy after env change ────────────────

test.describe("admin Postiz routes — still wired after env change", () => {
  test("GET /api/admin/postiz/health responds (2xx or 503 if Postiz unreachable)", async ({ request }) => {
    const res = await api(request, "get", "/api/admin/postiz/health", {
      headers: authHeaders,
    });
    // 200 = healthy, 503 = Postiz pod unreachable (acceptable in test env)
    expect([200, 503]).toContain(res.status());
  });

  test("GET /api/admin/postiz/integrations responds (not 401/403)", async ({ request }) => {
    const res = await api(request, "get", "/api/admin/postiz/integrations", {
      headers: authHeaders,
    });
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
    // 200 with data or 503 if Postiz pod unreachable
    expect([200, 503]).toContain(res.status());
  });

  test("GET /api/admin/postiz/posts responds (not 401/403)", async ({ request }) => {
    const res = await api(request, "get", "/api/admin/postiz/posts", {
      headers: authHeaders,
    });
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
    expect([200, 503]).toContain(res.status());
  });

  test("GET /api/admin/postiz (root) responds (not 401/403)", async ({ request }) => {
    const res = await api(request, "get", "/api/admin/postiz", {
      headers: authHeaders,
    });
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
  });
});
