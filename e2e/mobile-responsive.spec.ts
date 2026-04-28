import { test, expect } from "@playwright/test";

test.describe("Mobile & Responsive", () => {
  test("homepage main and h1 are visible on the active viewport", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("homepage exposes at least one navigable link", async ({ page }) => {
    await page.goto("/");
    const links = page.getByRole("link");
    await expect(links.first()).toBeVisible();
    expect(await links.count()).toBeGreaterThan(0);
  });

  test("footer contact link reaches the contact page", async ({ page }) => {
    await page.goto("/");
    // The footer link is rendered last and is visible on every viewport
    // (no hamburger gating it on mobile).
    await page
      .getByRole("link", { name: /contact/i })
      .last()
      .scrollIntoViewIfNeeded();
    await page.getByRole("link", { name: /contact/i }).last().click();
    await expect(page).toHaveURL(/\/contact/);
  });
});
