import { test, expect } from "@playwright/test";

/**
 * Migrated from __tests__/{stripe-webhook,hubspot-webhook,notion-webhook,
 * paypal-webhook,sentry-webhook,cron-*}.test.ts (Vitest → Playwright).
 *
 * Webhook signature gates — invalid/missing signatures must be rejected
 * before any business logic runs.
 */
test.describe("Webhook signature gates", () => {
  test("POST /api/webhooks/stripe without signature → 400", async ({ request }) => {
    const r = await request.post("/api/webhooks/stripe", { data: { type: "ping" } });
    expect([400, 401, 403]).toContain(r.status());
  });

  test("POST /api/webhooks/stripe with bad signature → 400", async ({ request }) => {
    const r = await request.post("/api/webhooks/stripe", {
      data: { type: "ping" },
      headers: { "stripe-signature": "bogus" },
    });
    expect([400, 401, 403]).toContain(r.status());
  });

  test("POST /api/webhooks/espocrm without secret → 4xx", async ({ request }) => {
    // EspoCRM webhook (replaced HubSpot 2026-06-20, PR #1043). Auth is a
    // URL-query-param secret rather than HMAC; rejects unauth POSTs with 4xx.
    const r = await request.post("/api/webhooks/espocrm", { data: [] });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });

  test("POST /api/webhooks/notion without signature → 4xx", async ({ request }) => {
    const r = await request.post("/api/webhooks/notion", { data: {} });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });
});

test.describe("Cron endpoints — auth gate", () => {
  const cronRoutes = [
    "/api/cron/slack-digest",
    "/api/cron/digest",
    "/api/cron/sync",
    "/api/cron/refresh-cache",
  ];
  for (const route of cronRoutes) {
    test(`GET ${route} without cron secret → 401/403/404`, async ({ request }) => {
      const r = await request.get(route);
      expect([401, 403, 404]).toContain(r.status());
    });
  }
});
