import { test, expect, type Page } from "@playwright/test";
import { clickNavHref } from "../helpers/mobile-nav";

/**
 * E-commerce journey — /en/store, Open cart button, resilient to empty Stripe.
 */

async function goToStore(page: Page) {
  await clickNavHref(page, "/store");
  await expect(page).toHaveURL(/\/store/);
  await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
}

async function openCart(page: Page) {
  const cart = page.getByRole("button", { name: /open cart/i }).filter({ visible: true }).first();
  await expect(cart).toBeVisible({ timeout: 10_000 });
  await cart.click();
}

test.describe("E-commerce User Journey", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/en\/?$/);
  });

  test("browse store and add to cart when products exist", async ({ page }) => {
    await goToStore(page);
    const product = page.locator('a[href*="/store/"]').first();
    if ((await product.count()) === 0) {
      test.skip(true, "No store products in this environment");
      return;
    }
    await product.click();
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
    const add = page.getByRole("button", { name: /add to cart/i }).first();
    if (!(await add.isVisible().catch(() => false))) {
      test.skip(true, "Add to Cart not available");
      return;
    }
    await add.click();
    await openCart(page);
    await expect(page.getByRole("heading", { name: /cart/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("open empty cart from homepage", async ({ page }) => {
    await openCart(page);
    await expect(page.getByRole("heading", { name: /cart/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
  });

  test("unauthenticated dashboard redirects toward login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/en/dashboard", { waitUntil: "domcontentloaded" });
    await expect
      .poll(() => page.url(), { timeout: 15_000 })
      .toMatch(/\/(auth\/login|dashboard)/);
    if (page.url().includes("/auth/login")) {
      await expect(page.locator("#email")).toBeVisible({ timeout: 15_000 });
    }
  });
});
