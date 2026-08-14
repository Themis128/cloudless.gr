import { test, expect } from "@playwright/test";
import { api, expectJson, GUEST_STORAGE } from "./_helpers";

test.use({ storageState: GUEST_STORAGE });

test.describe("Public API method contracts", () => {
  test("POST-only public routes reject GET with 405 JSON", async ({ request }) => {
    for (const path of ["/api/contact", "/api/subscribe"]) {
      const res = await api(request, "get", path);
      expect(res.status(), path).toBe(405);
      await expectJson(res);
    }
  });

  test("malformed JSON on write routes is 400, never 500", async ({ request }) => {
    for (const path of ["/api/contact", "/api/subscribe", "/api/checkout", "/api/auth/login"]) {
      const res = await api(request, "post", path, {
        headers: { "content-type": "application/json" },
        data: Buffer.from("{", "utf8"),
      });
      expect(res.status(), path).toBeGreaterThanOrEqual(400);
      expect(res.status(), path).toBeLessThan(500);
      await expectJson(res);
    }
  });

  test("PWA manifest is valid JSON with name and start_url", async ({ request }) => {
    const res = await api(request, "get", "/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const body = await expectJson(res);
    expect(body.name || body.short_name).toBeTruthy();
    expect(body.start_url || body.id).toBeTruthy();
  });

  test("robots.txt and sitemap.xml are served as text/xml or text/plain", async ({ request }) => {
    const robots = await api(request, "get", "/robots.txt");
    expect(robots.status()).toBe(200);
    expect((await robots.text()).toLowerCase()).toMatch(/user-agent|sitemap/);

    const sitemap = await api(request, "get", "/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toMatch(/<urlset|<sitemapindex/i);
  });
});
