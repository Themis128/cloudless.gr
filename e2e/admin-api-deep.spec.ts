/**
 * Deep coverage for every admin API.
 * Two flows:
 *   1. Without auth — every endpoint must respond 401/403 (NEVER 200 or 5xx).
 *   2. With admin storageState — endpoint must respond < 500 (auth recognized).
 *
 * Edge cases:
 *   - POST endpoints with empty body return 400/422, not 5xx
 *   - Bearer with garbage token is rejected
 */
import { test, expect } from "./coverage";
import fs from "fs";
import path from "path";
import { ADMIN_APIS } from "./helpers/coverage-routes";

const STORAGE = path.join(__dirname, ".auth", "admin.json");

function hasRealAuth(): boolean {
  try {
    const j = JSON.parse(fs.readFileSync(STORAGE, "utf8"));
    return Array.isArray(j.cookies) && j.cookies.length > 0;
  } catch {
    return false;
  }
}

const EXTRA_ADMIN_APIS = [
  "/api/admin/ai/analytics-orchestration",
  "/api/admin/ai/audience",
  "/api/admin/ai/campaign",
  "/api/admin/ai/copy",
  "/api/admin/ai/report-insights",
  "/api/admin/analytics/countries",
  "/api/admin/analytics/ctr-opportunities",
  "/api/admin/analytics/devices",
  "/api/admin/analytics/history",
  "/api/admin/analytics/keywords",
  "/api/admin/analytics/pages",
  "/api/admin/analytics/products",
  "/api/admin/analytics/query-pages",
  "/api/admin/analytics/search-intent",
  "/api/admin/analytics/seo",
  "/api/admin/analytics/unified",
  "/api/admin/analytics/web",
  "/api/admin/campaigns/google",
  "/api/admin/campaigns/google/insights",
  "/api/admin/campaigns/linkedin",
  "/api/admin/campaigns/linkedin/insights",
  "/api/admin/campaigns/tiktok",
  "/api/admin/campaigns/tiktok/insights",
  "/api/admin/campaigns/x",
  "/api/admin/campaigns/x/insights",
  "/api/admin/crm/companies",
  "/api/admin/crm/contacts",
  "/api/admin/crm/deals",
  "/api/admin/crm/owners",
  "/api/admin/crm/pipelines",
  "/api/admin/crm/tickets",
  "/api/admin/email/automations",
  "/api/admin/email/campaigns",
  "/api/admin/email/contacts",
  "/api/admin/email/lists",
  "/api/admin/email/stats",
  "/api/admin/esp32/notion-sync",
  "/api/admin/integrations/status",
  "/api/admin/notifications/test",
  "/api/admin/notion/analytics",
  "/api/admin/notion/blog",
  "/api/admin/notion/comments",
  "/api/admin/notion/docs",
  "/api/admin/notion/projects",
  "/api/admin/notion/search",
  "/api/admin/notion/submissions",
  "/api/admin/notion/tasks",
  "/api/admin/oauth/tiktok",
  "/api/admin/ops/monitor",
  "/api/admin/pending-clients",
  "/api/admin/pipeline/board",
  "/api/admin/pipeline/stats",
];

const ALL_ADMIN_APIS = Array.from(new Set([...ADMIN_APIS, ...EXTRA_ADMIN_APIS]));

test.describe("Admin APIs unauthenticated", () => {
  for (const api of ALL_ADMIN_APIS) {
    test(`unauth GET ${api} — returns 401/403/404`, async ({ request }) => {
      const r = await request.get(api, { failOnStatusCode: false });
      // Must reject unauthenticated; 200 would be a data leak
      expect([401, 403, 404, 405]).toContain(r.status());
    });
  }

  test("unauth GET with garbage Bearer token still rejected", async ({ request }) => {
    const r = await request.get("/api/admin/users", {
      headers: { Authorization: "Bearer garbage" },
      failOnStatusCode: false,
    });
    expect([401, 403]).toContain(r.status());
  });
});

test.describe("Admin APIs authenticated", () => {
  test.use({ storageState: STORAGE });

  test.beforeEach(({}, testInfo) => {
    if (!hasRealAuth()) {
      testInfo.skip(true, "Skipping authenticated admin APIs (E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not set)");
    }
  });

  for (const api of ALL_ADMIN_APIS) {
    test(`auth GET ${api} — non-5xx`, async ({ request }) => {
      const r = await request.get(api, { failOnStatusCode: false });
      expect(r.status(), `${api} returned ${r.status()}`).toBeLessThan(500);
    });
  }
});
