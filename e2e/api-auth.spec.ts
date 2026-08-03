import { test, expect } from "@playwright/test";

test.describe("API Authentication", () => {
  test("health endpoint returns 200 with status payload", async ({ page }) => {
    const response = await page.request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    // "ok" = fully healthy (D1 connected). "degraded" = server is up but
    // D1 isn't reachable (e.g. local dev without wrangler bindings).
    expect(["ok", "degraded"]).toContain(body.status);
    expect(typeof body.timestamp).toBe("string");
    expect(typeof body.version).toBe("string");
  });
});
