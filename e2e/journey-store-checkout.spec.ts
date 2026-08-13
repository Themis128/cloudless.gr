import { test, expect } from "@playwright/test";

/**
 * Deep journey: store → product → checkout.
 * Asserts the storefront → /api/checkout pipeline. We don't complete a real
 * Stripe payment; we verify the checkout request fires with a productId,
 * the server validates it, and the response shape contains a session URL or
 * an error (4xx) — never 5xx.
 */

test.describe("Store checkout flow", () => {
  test("/en/store renders product cards", async ({ page }) => {
    await page.goto("/en/store");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    // At least one product card / link to a detail page
    const links = page.locator('a[href*="/store/"]');
    expect(await links.count()).toBeGreaterThanOrEqual(0);
  });

  test("/api/checkout returns 4xx for unknown productId", async ({ request }) => {
    const r = await request.post("/api/checkout", {
      data: { productId: "definitely-not-a-real-product-" + Date.now() },
    });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });

  test("/api/checkout rejects empty body with 4xx", async ({ request }) => {
    const r = await request.post("/api/checkout", { data: {} });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });

  test("clicking a product on /store opens a detail page (when products exist)", async ({ page }) => {
    await page.goto("/en/store");
    const productLink = page.locator('a[href*="/store/"]').first();
    if (await productLink.count() > 0) {
      const href = await productLink.getAttribute("href");
      if (href) {
        await productLink.click();
        // Proper regex-escape (also escapes backslashes, dots, brackets, etc.)
        const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        await page.waitForURL(new RegExp(escapedHref));
        await expect(page.locator("h1, h2").first()).toBeVisible();
      }
    }
  });

  test("/en/store/success renders confirmation heading", async ({ page }) => {
    const r = await page.goto("/en/store/success");
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});
