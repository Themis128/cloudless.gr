import { test, expect } from "@playwright/test";

/**
 * Migrated from __tests__/admin-*.test.ts (Vitest → Playwright).
 *
 * Admin API surface:
 *
 * - 75+ admin route files exist; every one wraps requireAdmin(request) at the
 *   top of GET/POST/etc. (verified by audit). Unauthenticated requests get a
 *   401 with {"error":"Missing authorization token"}.
 *
 * - 6 admin "paths" don't have route.ts files (/api/admin/{analytics,
 *   campaigns,crm,email,pipeline,projects}) — they're parent dirs with sub-
 *   routes. Next.js falls through to not-found.tsx which renders with status
 *   200 (the HTML 404 page). Tests assert the body is HTML (not API JSON) so
 *   we don't paper over a real route ever appearing here unprotected.
 */

test.describe("Admin API — auth-gated mounted routes", () => {
  const mounted = [
    "/api/admin/calendar",
    "/api/admin/kpi",
    "/api/admin/notion/blog",
    "/api/admin/notion/docs",
    "/api/admin/notion/submissions",
    "/api/admin/notion/tasks",
    "/api/admin/ab-tests",
    "/api/admin/client-portals",
    "/api/admin/users",
    "/api/admin/workspaces",
    "/api/admin/orders",
    "/api/admin/integrations/status",
    "/api/admin/notifications",
    "/api/admin/ops/monitor",
  ];
  for (const route of mounted) {
    test(`GET ${route} rejects unauthenticated requests with 401/403`, async ({ request }) => {
      const r = await request.get(route);
      expect([401, 403]).toContain(r.status());
    });
  }
});

test.describe("Admin API — unmounted parent paths", () => {
  // These look like API routes but don't have route.ts files. Next.js renders
  // the not-found page (HTML, status 200). If anyone adds a real route at one
  // of these paths without auth, the contentType assertion will fail.
  const unmounted = [
    "/api/admin/analytics",
    "/api/admin/campaigns",
    "/api/admin/crm",
    "/api/admin/email",
    "/api/admin/pipeline",
    "/api/admin/projects",
  ];
  for (const route of unmounted) {
    test(`GET ${route} is the not-found HTML page (no API exposed)`, async ({ request }) => {
      const r = await request.get(route);
      const ct = r.headers()["content-type"] ?? "";
      // Either auth-gated (good) or the HTML fallback (no API mounted)
      if (r.status() === 401 || r.status() === 403) return;
      expect(ct).toMatch(/text\/html/i);
    });
  }
});

test.describe("Admin API — cache control", () => {
  test("GET /api/admin/cache returns 401 or 405", async ({ request }) => {
    const r = await request.get("/api/admin/cache");
    expect([401, 403, 405]).toContain(r.status());
  });
});

test.describe("Admin API — POST endpoints require auth", () => {
  test("POST /api/admin/ai/analytics-orchestration without auth → 401", async ({ request }) => {
    const r = await request.post("/api/admin/ai/analytics-orchestration", { data: {} });
    expect([401, 403]).toContain(r.status());
  });

  test("POST /api/admin/ai/analytics-orchestration/pdf without auth → 401", async ({ request }) => {
    const r = await request.post("/api/admin/ai/analytics-orchestration/pdf", { data: {} });
    expect([401, 403]).toContain(r.status());
  });
});
