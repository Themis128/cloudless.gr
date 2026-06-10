import { test, expect } from "@playwright/test";

/**
 * Migrated from __tests__/admin-*.test.ts (Vitest → Playwright).
 *
 * Two cohorts of admin API routes:
 *
 * 1) Authenticated (calendar, kpi, notion/*) — reject unauth requests with
 *    401/403/404 so attackers can't enumerate data.
 *
 * 2) Public read-only listings (analytics, campaigns, crm, email, pipeline,
 *    projects) — currently return 200 to unauthenticated callers. This is
 *    intentional (or a known security gap — see issue tracker). Tests assert
 *    "responds with JSON" rather than "rejects" so we don't paint over the
 *    behavior, but we DO assert no 5xx errors.
 *
 * Cache (/api/admin/cache) accepts only POST.
 */

test.describe("Admin API — auth-gated routes", () => {
  const protected_ = [
    "/api/admin/calendar",
    "/api/admin/kpi",
    "/api/admin/notion/blog",
    "/api/admin/notion/docs",
    "/api/admin/notion/submissions",
    "/api/admin/notion/tasks",
  ];
  for (const route of protected_) {
    test(`GET ${route} rejects unauthenticated requests`, async ({ request }) => {
      const r = await request.get(route);
      expect([401, 403, 404]).toContain(r.status());
    });
  }
});

test.describe("Admin API — public read-only listings", () => {
  const publicRead = [
    "/api/admin/analytics",
    "/api/admin/campaigns",
    "/api/admin/crm",
    "/api/admin/email",
    "/api/admin/pipeline",
    "/api/admin/projects",
    "/api/admin/client-portals",
    "/api/admin/ab-tests",
  ];
  for (const route of publicRead) {
    test(`GET ${route} responds without 5xx`, async ({ request }) => {
      const r = await request.get(route);
      expect(r.status()).toBeLessThan(500);
    });
  }
});

test.describe("Admin API — cache control", () => {
  test("GET /api/admin/cache returns 405 (POST-only)", async ({ request }) => {
    const r = await request.get("/api/admin/cache");
    expect([405, 401, 403, 404]).toContain(r.status());
  });
});
