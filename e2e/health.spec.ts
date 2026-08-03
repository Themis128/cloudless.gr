import { test, expect } from "@playwright/test";

/**
 * API health + basic availability tests.
 * These run against the local dev server (configured in playwright.config.mts).
 * For prod smoke tests use BASE_URL=https://cloudless.gr before running.
 */

test.describe("Health API", () => {
  test("GET /api/health returns 200 with status payload", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);

    const body = await res.json();
    // "ok" = fully healthy (D1 connected). "degraded" = server is up but
    // D1 isn't reachable (e.g. local dev without wrangler bindings).
    expect(["ok", "degraded"]).toContain(body.status);
    expect(typeof body.timestamp).toBe("string");
    expect(typeof body.version).toBe("string");
  });

  test("health response is fresh (timestamp within last 10s)", async ({ request }) => {
    const res = await request.get("/api/health");
    const { timestamp } = await res.json();
    const age = Date.now() - new Date(timestamp).getTime();
    expect(age).toBeLessThan(10_000);
  });
});
