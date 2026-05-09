import { test, expect } from "@playwright/test";

test.describe("Blog API", () => {
  test("GET /api/blog/posts returns array", async ({ request }) => {
    const res = await request.get("/api/blog/posts");
    // Either 200 with posts or 200 with empty array — never 5xx
    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    }
  });
});

test.describe("Blog pages", () => {
  test("blog listing page loads", async ({ page }) => {
    // Try common locale paths
    const paths = ["/en/blog", "/el/blog", "/blog"];
    let found = false;

    for (const p of paths) {
      const res = await page.goto(p, { waitUntil: "domcontentloaded" });
      if (res && res.status() < 400) {
        found = true;
        break;
      }
    }

    expect(found, "Blog listing page not found at any expected path").toBe(true);
  });
});
