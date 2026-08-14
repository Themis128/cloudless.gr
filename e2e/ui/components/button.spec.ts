import { test, expect } from "@playwright/test";

/**
 * Button smoke on the homepage — interactive controls exist and are named.
 */

test.describe("Button Component", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
  });

  test("page exposes buttons", async ({ page }) => {
    const buttons = page.getByRole("button");
    expect(await buttons.count()).toBeGreaterThan(0);
    await expect(buttons.first()).toBeVisible();
  });

  test("visible buttons have an accessible name", async ({ page }) => {
    const buttons = page.getByRole("button");
    const count = Math.min(await buttons.count(), 5);
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      if (!(await btn.isVisible().catch(() => false))) continue;
      const name = (await btn.getAttribute("aria-label")) || (await btn.textContent()) || "";
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });

  test("cart control exists when store chrome is present", async ({ page }) => {
    const cart = page.getByRole("button", { name: /open cart|cart/i }).first();
    await expect(cart).toBeVisible({ timeout: 10_000 });
  });
});
