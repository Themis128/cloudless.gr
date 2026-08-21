/**
 * AI backend chain — Playwright E2E tests
 *
 * Tests the full priority chain wired across all AI surfaces:
 *   1. NVIDIA proxy  (nemotron-3.5-lightning-30b-a3b + thinking, ?thinking=1)
 *   2. Workers AI    (llama-3.1-8b, Cloudflare edge)
 *   3. Ollama        (qwen2.5-coder:latest, self-hosted, Tailscale)
 *   4. Gemini        (last resort, external API)
 *
 * Surfaces tested:
 *   A. Public chatbot   POST /api/chat      → SSE stream
 *   B. Admin assistant  POST /api/admin/ai/assistant  → JSON tool loop
 *   C. Admin copy       POST /api/admin/ai/copy
 *   D. Admin campaign   POST /api/admin/ai/campaign
 *   E. Admin audience   POST /api/admin/ai/audience
 *   F. Admin insights   POST /api/admin/ai/report-insights
 *   G. Admin generate   POST /api/admin/ai/generate  (Workers AI direct)
 *
 * Each test verifies the route is wired and responds correctly.
 * We never assert which backend ran — that would break when one is
 * unreachable in CI. We assert the response contract instead:
 *   - correct HTTP status for valid / invalid input
 *   - required fields present in the JSON body
 *   - auth is enforced (401/403 without token)
 *   - route never crashes (no 5xx on valid input, only 502/503 if
 *     ALL backends are genuinely unreachable in the test environment)
 */

import { test, expect } from "@playwright/test";
import { ADMIN_TOKEN, api, expectJson } from "./_helpers";

const authHeaders = { authorization: `Bearer ${ADMIN_TOKEN}` };

// Valid responses: 200 (ran) or 502/503 (all backends unreachable in CI).
// Both prove the route is wired and the chain logic ran.
const AI_OK = [200, 502, 503];

// ── A. Public chatbot (/api/chat) ────────────────────────────────────────────

test.describe("POST /api/chat — public chatbot", () => {
  test("valid message returns SSE stream (200) or 502 when no backend", async ({ request }) => {
    const res = await api(request, "post", "/api/chat", {
      data: { messages: [{ role: "user", content: "hello" }] },
    });
    expect(AI_OK).toContain(res.status());
    if (res.status() === 200) {
      const ct = res.headers()["content-type"] ?? "";
      expect(ct).toContain("text/event-stream");
    }
  });

  test("missing messages body returns 400", async ({ request }) => {
    const res = await api(request, "post", "/api/chat", { data: {} });
    expect(res.status()).toBe(400);
  });

  test("empty messages array returns 400", async ({ request }) => {
    const res = await api(request, "post", "/api/chat", {
      data: { messages: [] },
    });
    expect(res.status()).toBe(400);
  });

  test("rate limit header or normal response on repeated calls", async ({ request }) => {
    // Two rapid calls — should not 500; rate limiter returns 429 at worst
    for (let i = 0; i < 2; i++) {
      const res = await api(request, "post", "/api/chat", {
        data: { messages: [{ role: "user", content: "ping" }] },
      });
      expect([200, 429, 502, 503]).toContain(res.status());
    }
  });
});

// ── B. Admin assistant (tool loop) ──────────────────────────────────────────

test.describe("POST /api/admin/ai/assistant", () => {
  test("401 without auth token", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/assistant", {
      data: { messages: [{ role: "user", content: "what are recent orders?" }] },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("valid request returns response + toolsUsed + provider", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/assistant", {
      headers: authHeaders,
      data: { messages: [{ role: "user", content: "summarise recent revenue" }] },
    });
    expect(AI_OK).toContain(res.status());
    if (res.status() === 200) {
      const body = await expectJson(res);
      expect(typeof body.response).toBe("string");
      expect((body.response as string).length).toBeGreaterThan(0);
      expect(Array.isArray(body.toolsUsed)).toBe(true);
      expect(["nvidia-proxy", "workers-ai", "ollama", "gemini"]).toContain(body.provider);
    }
  });

  test("missing messages body returns 400", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/assistant", {
      headers: authHeaders,
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("empty messages array returns 400", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/assistant", {
      headers: authHeaders,
      data: { messages: [] },
    });
    expect(res.status()).toBe(400);
  });

  test("multi-turn conversation carries history", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/assistant", {
      headers: authHeaders,
      data: {
        messages: [
          { role: "user", content: "what is the top keyword?" },
          { role: "assistant", content: "The top keyword is cloud hosting." },
          { role: "user", content: "and the second?" },
        ],
      },
    });
    expect(AI_OK).toContain(res.status());
  });
});

// ── C. Admin copy generation ─────────────────────────────────────────────────

test.describe("POST /api/admin/ai/copy", () => {
  test("401 without auth", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/copy", {
      data: { service: "cloud hosting", platform: "LinkedIn", objective: "awareness" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("valid request returns text or 503 when backend unreachable", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/copy", {
      headers: authHeaders,
      data: {
        service: "cloud hosting for SMBs",
        platform: "LinkedIn",
        objective: "lead generation",
        language: "English",
      },
    });
    expect(AI_OK).toContain(res.status());
    if (res.status() === 200) {
      const body = await expectJson(res);
      expect(typeof (body.text ?? body.result ?? body.copy)).toBe("string");
    }
  });

  test("missing service returns 400", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/copy", {
      headers: authHeaders,
      data: { platform: "LinkedIn" },
    });
    expect(res.status()).toBe(400);
  });
});

// ── D. Admin campaign generation ─────────────────────────────────────────────

test.describe("POST /api/admin/ai/campaign", () => {
  test("401 without auth", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/campaign", {
      data: { brief: "launch cloud hosting" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("valid request responds in AI_OK range", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/campaign", {
      headers: authHeaders,
      data: {
        brief: "Launch serverless hosting for Greek SMBs",
        budget: "€2000",
        targetAudience: "Tech startups in Greece",
      },
    });
    expect(AI_OK).toContain(res.status());
    if (res.status() === 200) {
      const body = await expectJson(res);
      expect(body.provider ?? body.text ?? body.result).toBeTruthy();
    }
  });

  test("missing brief returns 400", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/campaign", {
      headers: authHeaders,
      data: { budget: "€1000" },
    });
    expect(res.status()).toBe(400);
  });
});

// ── E. Admin audience targeting ──────────────────────────────────────────────

test.describe("POST /api/admin/ai/audience", () => {
  test("401 without auth", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/audience", {
      data: { description: "tech founders" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("valid request responds in AI_OK range", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/audience", {
      headers: authHeaders,
      data: {
        description: "Greek startup founders aged 25-45",
        platforms: ["LinkedIn", "Meta"],
        objective: "LEAD_GENERATION",
      },
    });
    expect(AI_OK).toContain(res.status());
  });

  test("missing description returns 400", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/audience", {
      headers: authHeaders,
      data: { platforms: ["Meta"] },
    });
    expect(res.status()).toBe(400);
  });
});

// ── F. Admin report insights ──────────────────────────────────────────────────

test.describe("POST /api/admin/ai/report-insights", () => {
  test("401 without auth", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/report-insights", {
      data: { metrics: { visits: 1200, conversions: 42 }, period: "last 30 days" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("valid request responds in AI_OK range", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/report-insights", {
      headers: authHeaders,
      data: {
        metrics: { visits: 3200, leads: 18, revenue: 4800, conversion_rate: 0.56 },
        period: "August 2026",
      },
    });
    expect(AI_OK).toContain(res.status());
    if (res.status() === 200) {
      const body = await expectJson(res);
      expect(body.provider ?? body.text ?? body.insights).toBeTruthy();
    }
  });

  test("missing metrics returns 400", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/report-insights", {
      headers: authHeaders,
      data: { period: "last 30 days" },
    });
    expect(res.status()).toBe(400);
  });
});

// ── G. Admin generate (Workers AI direct) ────────────────────────────────────

test.describe("POST /api/admin/ai/generate", () => {
  test("401 without auth", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/generate", {
      data: { prompt: "hello" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("valid prompt responds with result or 503 when Workers AI not configured", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/generate", {
      headers: authHeaders,
      data: { prompt: "Write one sentence about cloud hosting." },
    });
    expect([200, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await expectJson(res);
      expect(body.success).toBe(true);
      expect(typeof body.result).toBe("string");
      expect(typeof body.model).toBe("string");
    }
  });

  test("empty prompt returns 400", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/generate", {
      headers: authHeaders,
      data: { prompt: "" },
    });
    expect(res.status()).toBe(400);
  });

  test("invalid model is silently replaced with default", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/generate", {
      headers: authHeaders,
      data: { prompt: "test", model: "gpt-99-not-real" },
    });
    // Route resets unknown model to DEFAULT_MODEL — should not 400
    expect([200, 503]).toContain(res.status());
  });
});

// ── H. Provider field contract (integration smoke) ───────────────────────────

test.describe("provider field contract — assistant + copy return known provider", () => {
  test("assistant response.provider is one of the four known backends", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/assistant", {
      headers: authHeaders,
      data: { messages: [{ role: "user", content: "hi" }] },
    });
    if (res.status() !== 200) return; // backend unreachable in CI — skip assertion
    const body = await expectJson(res);
    expect(["nvidia-proxy", "workers-ai", "ollama", "gemini"]).toContain(body.provider);
  });

  test("copy response.provider is one of the four known backends", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/ai/copy", {
      headers: authHeaders,
      data: { service: "cloud infrastructure", platform: "Meta", objective: "awareness", language: "English" },
    });
    if (res.status() !== 200) return;
    const body = await expectJson(res);
    expect(["nvidia-proxy", "workers-ai", "ollama", "gemini"]).toContain(body.provider);
  });
});
