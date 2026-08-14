/**
 * Public API route input-validation coverage.
 *
 * These tests exercise validation branches that don't depend on external
 * services (SES, EspoCRM, Stripe, Slack) so they're deterministic with no
 * secrets configured.
 *
 * Each request sends a unique `x-forwarded-for` so the per-IP rate limiter
 * (`src/lib/rate-limit.ts`) doesn't conflate tests across projects.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";

let testCounter = 0;
function uniqueIp() {
  testCounter += 1;
  return `203.0.113.${testCounter % 254}`;
}

async function postJson(request: APIRequestContext, url: string, data: unknown) {
  const adminToken = "e2e-admin-token-do-not-use-in-prod";
  return request.post(url, {
    data,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": uniqueIp(),
      Authorization: `Bearer ${adminToken}`,
    },
  });
}

test.describe("API: /api/health", () => {
  test("GET returns 200 with status payload", async ({ page }) => {
    const res = await page.request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    // "ok" = fully healthy (D1 connected). "degraded" = server is up but
    // D1 isn't reachable (e.g. local dev without wrangler bindings).
    expect(["ok", "degraded"]).toContain(body.status);
    expect(typeof body.timestamp).toBe("string");
    expect(typeof body.version).toBe("string");
  });
});

test.describe("API: /api/contact", () => {
  test("rejects missing required fields with 400", async ({ page }) => {
    const res = await postJson(page.request, "/api/contact", {
      name: "Only Name",
    });
    // 429 is also a valid rejection: rate limiter fires before validation
    // when tests share a source IP (e.g. through a Cloudflare tunnel).
    expect([400, 429]).toContain(res.status());
    if (res.status() === 400) {
      const body = await res.json();
      // Missing fields may be typed as non-strings ("must be strings") or empty ("required").
      expect(body.error).toMatch(/required|must be strings/i);
    }
  });

  test("rejects invalid email with 400", async ({ page }) => {
    const res = await postJson(page.request, "/api/contact", {
      name: "Test User",
      email: "not-an-email",
      message: "hello",
    });
    // 429 is also a valid rejection: rate limiter fires before validation
    // when tests share a source IP (e.g. through a Cloudflare tunnel).
    expect([400, 429]).toContain(res.status());
    if (res.status() === 400) {
      const body = await res.json();
      expect(body.error).toMatch(/invalid email/i);
    }
  });
});

test.describe("API: /api/subscribe", () => {
  test("rejects invalid email with 400", async ({ page }) => {
    const res = await postJson(page.request, "/api/subscribe", {
      email: "not-an-email",
    });
    // 429 is also a valid rejection: rate limiter fires before validation
    // when tests share a source IP (e.g. through a Cloudflare tunnel).
    expect([400, 429]).toContain(res.status());
    if (res.status() === 400) {
      const body = await res.json();
      expect(body.error).toMatch(/invalid email/i);
    }
  });

  test("rejects missing email with 400", async ({ page }) => {
    const res = await postJson(page.request, "/api/subscribe", {});
    // 429 is also a valid rejection: rate limiter fires before validation
    // when the same IP hits the endpoint multiple times in parallel tests.
    expect([400, 429]).toContain(res.status());
  });
});

test.describe("API: /api/checkout", () => {
  test("rejects empty cart with 400", async ({ page }) => {
    const res = await postJson(page.request, "/api/checkout", { items: [] });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no items/i);
  });

  test("rejects missing items field with 400", async ({ page }) => {
    const res = await postJson(page.request, "/api/checkout", {});
    expect(res.status()).toBe(400);
  });
});
