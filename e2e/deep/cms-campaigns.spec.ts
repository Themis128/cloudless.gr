import { test, expect } from "@playwright/test";
import { GUEST_STORAGE } from "./_helpers";

test.use({ storageState: GUEST_STORAGE });

test.describe("CMS, campaigns, legal", () => {
  test("blog index renders; empty CMS shows the empty state, not a crash", async ({ page }) => {
    const res = await page.goto("/en/blog");
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 20_000 });
    const post = page.locator('a[href*="/blog/"]').filter({ hasNot: page.locator('[href$="/blog"]') });
    const empty = page.getByText(/no posts found/i);
    const hasPost = (await post.count()) > 0;
    const hasEmpty = await empty.isVisible().catch(() => false);
    expect(hasPost || hasEmpty).toBeTruthy();
    if (hasPost) {
      await post.first().click();
      await expect(page).toHaveURL(/\/en\/blog\/.+/);
      await expect(page.locator("article, h1, main").first()).toBeVisible();
    }
  });

  test("docs index is a real page, not a 404", async ({ page }) => {
    const res = await page.goto("/en/docs");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("h1, h2, main").first()).toBeVisible({ timeout: 20_000 });
  });

  test("shop-online campaign landing exposes a checkout CTA", async ({ page }) => {
    const res = await page.goto("/en/campaigns/shop-online");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 20_000 });
    const cta = page.locator('a[href*="checkout"], a[href*="contact"], button').filter({
      hasText: /starter|choose|shop|contact|fit/i,
    });
    await expect(cta.first()).toBeVisible();
  });

  test("legal pages have a heading and a main landmark", async ({ page }) => {
    for (const path of ["/en/privacy", "/en/terms", "/en/cookies", "/en/refund"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBeLessThan(400);
      await expect(page.locator("main#main-content")).toBeVisible();
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });

  test("services page lists offerings and a contact CTA", async ({ page }) => {
    await page.goto("/en/services");
    await expect(page.getByTestId("services-container")).toBeVisible({ timeout: 20_000 });
    expect(await page.getByTestId("service-item").count()).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId("services-cta")).toBeVisible();
  });
});
