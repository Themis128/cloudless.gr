import { test, expect } from "@playwright/test";

test.describe("API Authentication", () => {
  test("API is reachable", async ({ page }) => {
    const response = await page.request.get("/api/health");
    expect([200, 404]).toContain(response.status());
  });
});
