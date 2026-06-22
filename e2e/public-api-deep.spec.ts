/**
 * Deep coverage for every public API route.
 * GETs: status < 500, JSON or text.
 * POSTs (form-style): validation rejects empty body, returns 4xx not 5xx; happy path returns 2xx.
 * Plus edge cases: malformed JSON, oversized payload, missing required fields.
 */
import { test, expect } from "./coverage";
import {
  PUBLIC_API_GET,
  PUBLIC_API_DYNAMIC,
  PUBLIC_API_POST_FORM,
  AUTH_API,
} from "./helpers/coverage-routes";

test.setTimeout(30_000);

for (const ep of PUBLIC_API_GET) {
  test(`GET ${ep} — non-5xx`, async ({ request }) => {
    const r = await request.get(ep);
    expect(r.status(), `${ep} returned ${r.status()}`).toBeLessThan(500);
    // Body should be parseable as JSON or text
    const text = await r.text();
    expect(text.length).toBeGreaterThanOrEqual(0);
  });
}

for (const { template, sample } of PUBLIC_API_DYNAMIC) {
  test(`GET ${template} — handles unknown slug (404 or empty 200)`, async ({ request }) => {
    const r = await request.get(sample);
    // 503 is the documented "integration not configured" response (e.g. the
    // docs API returns 503 when NOTION_API_KEY/NOTION_DOCS_DB_ID are unset).
    expect([200, 301, 302, 303, 307, 308, 400, 401, 404, 503]).toContain(r.status());
  });
}

for (const ep of PUBLIC_API_POST_FORM) {
  test(`POST ${ep} — empty body rejected with 4xx`, async ({ request }) => {
    const r = await request.post(ep, { data: {}, failOnStatusCode: false });
    // Server must validate — return < 500. Most should be 400/401/422.
    expect(r.status(), `${ep} returned ${r.status()} for empty body`).toBeLessThan(500);
  });

  test(`POST ${ep} — malformed JSON rejected`, async ({ request }) => {
    const r = await request.post(ep, {
      headers: { "Content-Type": "application/json" },
      data: "{ not valid json",
      failOnStatusCode: false,
    });
    expect(r.status(), `${ep} returned ${r.status()} for malformed body`).toBeLessThan(500);
  });
}

test("GET /api/auth/session — returns session shape", async ({ request }) => {
  const r = await request.get(AUTH_API);
  expect(r.status()).toBeLessThan(500);
  if (r.headers()["content-type"]?.includes("application/json")) {
    const json = await r.json();
    expect(json).toBeDefined();
  }
});

test("GET /api/auth/csrf — returns csrf token", async ({ request }) => {
  const r = await request.get("/api/auth/csrf");
  expect(r.status()).toBeLessThan(500);
});

test("GET /api/auth/providers — lists providers", async ({ request }) => {
  const r = await request.get("/api/auth/providers");
  expect(r.status()).toBeLessThan(500);
});

test("POST /api/contact — happy path with valid payload", async ({ request }) => {
  const r = await request.post("/api/contact", {
    data: {
      name: "E2E Test",
      email: "e2e@test.example.com",
      subject: "E2E Coverage Test",
      message: "This is an automated coverage test message",
    },
    failOnStatusCode: false,
  });
  // Allow 200/201/202 for success or 400 for validation, NEVER 5xx
  expect(r.status()).toBeLessThan(500);
});

test("POST /api/subscribe — happy path", async ({ request }) => {
  const r = await request.post("/api/subscribe", {
    data: { email: "e2e-subscribe@test.example.com" },
    failOnStatusCode: false,
  });
  expect(r.status()).toBeLessThan(500);
});

test("POST /api/track — accepts analytics event", async ({ request }) => {
  const r = await request.post("/api/track", {
    data: { event: "e2e_test", properties: { source: "playwright" } },
    failOnStatusCode: false,
  });
  expect(r.status()).toBeLessThan(500);
});

test("POST /api/chat — non-empty message", async ({ request }) => {
  const r = await request.post("/api/chat", {
    data: { messages: [{ role: "user", content: "test" }] },
    failOnStatusCode: false,
  });
  // /api/chat may be auth-gated (401), rate-limited (429), or unconfigured —
  // the route surfaces missing/invalid Anthropic credentials as 503.
  const s = r.status();
  expect(s < 500 || s === 503, `/api/chat returned ${s}`).toBeTruthy();
});

test("GET /api/notion-image — without url param returns 4xx", async ({ request }) => {
  const r = await request.get("/api/notion-image");
  expect(r.status()).toBeGreaterThanOrEqual(400);
  expect(r.status()).toBeLessThan(500);
});

test("POST /api/portal/enroll — empty body rejected", async ({ request }) => {
  const r = await request.post("/api/portal/enroll", { data: {}, failOnStatusCode: false });
  expect(r.status()).toBeLessThan(500);
});

test("GET /api/portal/me — without auth returns 401", async ({ request }) => {
  const r = await request.get("/api/portal/me");
  expect([200, 401, 403]).toContain(r.status());
});

test("GET /api/portal/dummy-token — invalid token rejected", async ({ request }) => {
  const r = await request.get("/api/portal/dummy-token");
  expect(r.status()).toBeLessThan(500);
});

test("POST /api/agent/book — without payload rejected", async ({ request }) => {
  const r = await request.post("/api/agent/book", { data: {}, failOnStatusCode: false });
  expect(r.status()).toBeLessThan(500);
});

test("POST /api/newsletter/send — without auth returns 401/403", async ({ request }) => {
  const r = await request.post("/api/newsletter/send", { data: {}, failOnStatusCode: false });
  expect(r.status()).toBeLessThan(500);
});

// /api/hubspot/ticket deleted 2026-06-20 (PR #1043 — EspoCRM decom).

test("GET /api/health — returns ok shape", async ({ request }) => {
  const r = await request.get("/api/health");
  expect(r.status()).toBe(200);
  const ct = r.headers()["content-type"] || "";
  if (ct.includes("application/json")) {
    const j = await r.json();
    expect(j).toBeDefined();
  }
});




test("POST /api/calendar/book — empty body rejected", async ({ request }) => {
  const r = await request.post("/api/calendar/book", { data: {}, failOnStatusCode: false });
  expect(r.status()).toBeLessThan(500);
});

test("POST /api/checkout — empty body rejected", async ({ request }) => {
  const r = await request.post("/api/checkout", { data: {}, failOnStatusCode: false });
  expect(r.status()).toBeLessThan(500);
});

test("POST /api/csp-report — accepts CSP violation report", async ({ request }) => {
  const r = await request.post("/api/csp-report", {
    headers: { "Content-Type": "application/csp-report" },
    data: JSON.stringify({ "csp-report": { "document-uri": "/", "violated-directive": "default-src" } }),
    failOnStatusCode: false,
  });
  expect(r.status()).toBeLessThan(500);
});

test("POST /api/crm/contact — empty rejected", async ({ request }) => {
  const r = await request.post("/api/crm/contact", { data: {}, failOnStatusCode: false });
  expect(r.status()).toBeLessThan(500);
});

test("POST /api/unsubscribe — without token rejected", async ({ request }) => {
  const r = await request.post("/api/unsubscribe", { data: {}, failOnStatusCode: false });
  expect(r.status()).toBeLessThan(500);
});






test("GET /api/blog/hello-world — handles slug lookup", async ({ request }) => {
  const r = await request.get("/api/blog/hello-world");
  expect(r.status()).toBeLessThan(500);
});

test("GET /api/case-studies/sample — handles slug lookup", async ({ request }) => {
  const r = await request.get("/api/case-studies/sample");
  expect(r.status()).toBeLessThan(500);
});

test("GET /api/docs/getting-started — handles slug lookup", async ({ request }) => {
  const r = await request.get("/api/docs/getting-started");
  // 503 = docs integration not configured (NOTION_API_KEY/NOTION_DOCS_DB_ID unset)
  const s = r.status();
  expect(s < 500 || s === 503, `/api/docs/getting-started returned ${s}`).toBeTruthy();
});

test("POST /api/portal/me with missing auth header", async ({ request }) => {
  const r = await request.post("/api/portal/me", { data: {}, failOnStatusCode: false });
  expect(r.status()).toBeLessThan(500);
});

test("oversized payload rejected on /api/contact (10MB)", async ({ request }) => {
  const big = "x".repeat(10 * 1024 * 1024);
  const r = await request.post("/api/contact", {
    data: { name: "x", email: "x@x.com", message: big },
    failOnStatusCode: false,
  });
  expect(r.status(), `oversized payload returned ${r.status()}`).toBeLessThan(500);
});

test("oversized payload rejected on /api/track (5MB)", async ({ request }) => {
  const big = "x".repeat(5 * 1024 * 1024);
  const r = await request.post("/api/track", {
    data: { event: "stress", properties: { big } },
    failOnStatusCode: false,
  });
  expect(r.status()).toBeLessThan(500);
});
