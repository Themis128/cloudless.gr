import { test, expect } from "@playwright/test";

test.describe("Response time budgets", () => {
  test("homepage responds within 10s (dev) / 3s (prod)", async ({ page }) => {
    // Dev server cold-start can take 7-8s; production CloudFront is <1s.
    // Threshold is intentionally loose for local dev. CI against prod uses INFRA_SMOKE.
    const isProd = !!process.env.INFRA_SMOKE;
    const budget = isProd ? 3_000 : 10_000;
    const start = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(Date.now() - start).toBeLessThan(budget);
  });

  test("health API responds within 500ms", async ({ request }) => {
    const start = Date.now();
    await request.get("/api/health");
    expect(Date.now() - start).toBeLessThan(500);
  });
});

test.describe("SEO basics", () => {
  test("homepage has exactly one H1", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });

  test("all images have alt text", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    const missing = await page.evaluate(() =>
      Array.from(document.querySelectorAll("img"))
        .filter((img) => !img.alt && !img.getAttribute("aria-hidden"))
        .map((img) => img.src),
    );
    expect(missing, `Images missing alt: ${missing.join(", ")}`).toHaveLength(0);
  });
});
