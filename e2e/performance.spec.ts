import { test, expect } from "@playwright/test";

test.describe("Response time budgets", () => {
  test("homepage responds within 10s (dev) / 3s (prod)", async ({ page, baseURL }) => {
    // Dev server cold-start can take 7-8s; production CloudFront is <1s.
    // Use baseURL to detect prod vs local — INFRA_SMOKE may be set even when
    // running against localhost, which would apply an unfairly tight budget.
    const isProd = !!(baseURL && !baseURL.includes("localhost"));
    const budget = isProd ? 3_000 : 10_000;
    const start = Date.now();
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    expect(Date.now() - start).toBeLessThan(budget);
  });

  test("health API responds within 500ms (prod) / 3s (dev)", async ({ request, baseURL }) => {
    const isProd = !!(baseURL && !baseURL.includes("localhost"));
    const budget = isProd ? 500 : 3_000;
    const start = Date.now();
    await request.get("/api/health");
    expect(Date.now() - start).toBeLessThan(budget);
  });
});

test.describe("SEO basics", () => {
  test("homepage has exactly one H1", async ({ page }) => {
    await page.goto("/en");
    await page.waitForLoadState("domcontentloaded");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });

  test("all images have alt text", async ({ page }) => {
    await page.goto("/en");
    await page.waitForLoadState("domcontentloaded");
    const missing = await page.evaluate(() =>
      Array.from(document.querySelectorAll("img"))
        .filter((img) => !img.alt && !img.getAttribute("aria-hidden"))
        .map((img) => img.src),
    );
    expect(missing, `Images missing alt: ${missing.join(", ")}`).toHaveLength(0);
  });
});
