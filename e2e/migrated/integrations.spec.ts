import { test, expect } from "@playwright/test";

test.describe("Calendar API", () => {
  test("GET /api/calendar/availability responds without 5xx", async ({ request }) => {
    const r = await request.get("/api/calendar/availability");
    expect(r.status()).toBeLessThan(500);
  });
});

test.describe("Blog (public)", () => {
  test("GET /en/blog renders with a heading", async ({ page }) => {
    const r = await page.goto("/en/blog");
    expect(r?.status()).toBe(200);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});

test.describe("i18n routing", () => {
  for (const locale of ["en", "el"]) {
    test(`GET /${locale} returns 200`, async ({ request }) => {
      const r = await request.get(`/${locale}`);
      expect(r.status()).toBe(200);
    });
  }

  test("GET /zz unknown locale falls back or 404s", async ({ request }) => {
    const r = await request.get("/zz");
    expect([200, 307, 308, 404]).toContain(r.status());
  });
});

test.describe("A/B flags", () => {
  test("GET /api/ab/variant responds without 5xx", async ({ request }) => {
    const r = await request.get("/api/ab/variant?test=hero-cta");
    expect(r.status()).toBeLessThan(500);
  });
});

test.describe("Search / Notion-backed lookups", () => {
  test("GET /api/search responds without 5xx", async ({ request }) => {
    const r = await request.get("/api/search?q=cloud");
    expect(r.status()).toBeLessThan(500);
  });
});

test.describe("Store page", () => {
  test("/en/store loads with 200 and renders content", async ({ page }) => {
    const r = await page.goto("/en/store");
    expect(r?.status()).toBe(200);
    const text = await page.locator("body").innerText();
    expect(text.length).toBeGreaterThan(50);
  });
});
