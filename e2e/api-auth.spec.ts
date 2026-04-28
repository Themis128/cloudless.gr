import { test, expect } from "@playwright/test";

test.describe("API Authentication", () => {
  test("health endpoint returns 200 with status payload", async ({ page }) => {
    const response = await page.request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({ status: "ok" });
    expect(typeof body.timestamp).toBe("string");
    expect(typeof body.version).toBe("string");
  });
});
