/**
 * Public API route input-validation coverage.
 *
 * These tests exercise validation branches that don't depend on external
 * services (SES, HubSpot, Stripe, Slack) so they're deterministic with no
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

async function postJson(
  request: APIRequestContext,
  url: string,
  data: unknown
) {
  return request.post(url, {
    data,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": uniqueIp(),
    },
  });
}

test.describe("API: /api/health", () => {
  test("GET returns 200 with status payload", async ({ page }) => {
    const res = await page.request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    expect(typeof body.version).toBe("string");
  });
});

test.describe("API: /api/contact", () => {
  test("rejects missing required fields with 400", async ({ page }) => {
    const res = await postJson(page.request, "/api/contact", {
      name: "Only Name",
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  test("rejects invalid email with 400", async ({ page }) => {
    const res = await postJson(page.request, "/api/contact", {
      name: "Test User",
      email: "not-an-email",
      message: "hello",
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid email/i);
  });
});

test.describe("API: /api/subscribe", () => {
  test("rejects invalid email with 400", async ({ page }) => {
    const res = await postJson(page.request, "/api/subscribe", {
      email: "not-an-email",
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid email/i);
  });

  test("rejects missing email with 400", async ({ page }) => {
    const res = await postJson(page.request, "/api/subscribe", {});
    expect(res.status()).toBe(400);
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
