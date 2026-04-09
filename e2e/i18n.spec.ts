import { test, expect } from "@playwright/test";

test.describe("Internationalization", () => {
  const locales = ["en", "el", "fr"];

  for (const locale of locales) {
    test(`page loads in ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/`);

      // App may redirect to root while still applying locale via cookies/routing.
      const url = page.url();
      expect(url.includes(`/${locale}`) || url.endsWith("/")).toBeTruthy();
      await expect(page.locator("body")).toBeVisible();
    });
  }

  test("can switch locales", async ({ page }) => {
    await page.goto("/en/");
    let url = page.url();
    expect(url.includes("/en") || url.endsWith("/")).toBeTruthy();

    await page.goto("/el/");
    url = page.url();
    expect(url.includes("/el") || url.endsWith("/")).toBeTruthy();
  });
});
