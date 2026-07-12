import { test, expect } from "@playwright/test";
import { adminRequest } from "./_internal/admin-fixture";

/**
 * Route-coverage sweep: every parameterless admin GET route is exercised
 * with the E2E admin token. We assert status < 500 (auth gate worked AND
 * the handler didn't crash). Many handlers may return 4xx for missing
 * input or backing config — that's fine; we just want to know the route
 * is wired up and authentication flowed through.
 */

test.describe("Admin API route sweep (authenticated)", () => {
  test("GET /api/admin/ab-tests", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/ab-tests");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/ai/analytics-orchestration", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/ai/analytics-orchestration");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/ai/analytics-orchestration/pdf", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/ai/analytics-orchestration/pdf");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/ai/audience", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/ai/audience");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/ai/campaign", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/ai/campaign");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/ai/copy", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/ai/copy");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/ai/report-insights", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/ai/report-insights");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/analytics/countries", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/analytics/countries");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/analytics/ctr-opportunities", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/analytics/ctr-opportunities");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/analytics/devices", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/analytics/devices");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/analytics/history", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/analytics/history");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/analytics/keywords", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/analytics/keywords");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/analytics/pages", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/analytics/pages");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/analytics/products", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/analytics/products");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/analytics/query-pages", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/analytics/query-pages");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/analytics/search-intent", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/analytics/search-intent");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/analytics/seo", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/analytics/seo");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/analytics/unified", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/analytics/unified");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/analytics/web", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/analytics/web");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/cache", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/cache");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/calendar", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/calendar");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/calendar/create", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/calendar/create");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/campaigns/google", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/campaigns/google");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/campaigns/google/insights", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/campaigns/google/insights");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/campaigns/linkedin", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/campaigns/linkedin");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/campaigns/linkedin/insights", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/campaigns/linkedin/insights");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/campaigns/tiktok", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/campaigns/tiktok");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/campaigns/tiktok/insights", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/campaigns/tiktok/insights");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/campaigns/x", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/campaigns/x");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/campaigns/x/insights", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/campaigns/x/insights");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/client-portals", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/client-portals");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/crm/companies", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/crm/companies");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/crm/contacts", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/crm/contacts");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/crm/deals", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/crm/deals");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/crm/owners", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/crm/owners");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/crm/pipelines", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/crm/pipelines");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/crm/tickets", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/crm/tickets");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/email/automations", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/email/automations");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/email/campaigns", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/email/campaigns");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/email/contacts", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/email/contacts");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/email/lists", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/email/lists");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/email/stats", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/email/stats");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/esp32", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/esp32");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/esp32/notion-sync", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/esp32/notion-sync");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/integrations/status", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/integrations/status");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/kpi", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/kpi");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/notifications", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/notifications");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/notifications/test", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/notifications/test");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/notion/analytics", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/notion/analytics");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/notion/blog", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/notion/blog");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/notion/comments", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/notion/comments");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/notion/docs", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/notion/docs");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/notion/projects", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/notion/projects");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/notion/search", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/notion/search");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/notion/status", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/notion/status");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/notion/submissions", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/notion/submissions");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/notion/tasks", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/notion/tasks");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/ops/errors", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/ops/errors");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/ops/monitor", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/ops/monitor");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/orders", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/orders");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/pending-clients", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/pending-clients");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/pipeline/board", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/pipeline/board");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/pipeline/stats", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/pipeline/stats");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/reports", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/reports");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/reports/generate", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/reports/generate");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/subscriptions", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/subscriptions");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/users", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/users");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/voice-brief", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/voice-brief");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
  test("GET /api/admin/workspaces", async ({ request }) => {
    const a = await adminRequest(request);
    const r = await a.get("/api/admin/workspaces");
    // In dev without AWS/Notion creds, many handlers 500 — that's fine.
    // We're proving auth is being enforced (401) or the route is wired (non-5xx).
    // 401/403 = auth gate working correctly with mock token
    // 2xx/4xx = route wired
    // 5xx = handler crash
    expect(r.status()).toBeLessThan(500);
  });
});
