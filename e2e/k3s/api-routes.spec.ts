/**
 * API-surface coverage — verifies common public Next.js API routes work
 * through the standby pipeline (no auth required for these).
 */
import { test, expect } from "@playwright/test";
import { getWithRetry } from "./_helpers";

const BASE = "https://cloudless.online";

test.describe("k3s API routes", () => {
  test("/api/health → 200 JSON", async ({ request }) => {
    const r = await getWithRetry(request, `${BASE}/api/health`);
    expect(r.status).toBe(200);
    const body = JSON.parse(r.body);
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    expect(typeof body.version).toBe("string");
  });

  test("/api/health Content-Type is application/json", async ({ request }) => {
    const r = await getWithRetry(request, `${BASE}/api/health`);
    const ct = r.headers["content-type"] ?? "";
    expect(ct).toContain("application/json");
  });

  test("/sitemap.xml renders or returns 200/3xx", async ({ request }) => {
    const r = await request.get(`${BASE}/sitemap.xml`, {
      maxRedirects: 5,
      failOnStatusCode: false,
    });
    expect([200, 301, 302, 307, 308].includes(r.status())).toBe(true);
  });

  test("/robots.txt is reachable", async ({ request }) => {
    const r = await request.get(`${BASE}/robots.txt`, { failOnStatusCode: false });
    expect([200, 301, 302, 307, 308, 404].includes(r.status())).toBe(true);
    // 404 is acceptable if the app doesn't ship one.
  });

  test("non-existent API path returns 4xx (not 5xx)", async ({ request }) => {
    const r = await request.get(`${BASE}/api/__definitely_not_a_route__`, {
      failOnStatusCode: false,
    });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });
});
