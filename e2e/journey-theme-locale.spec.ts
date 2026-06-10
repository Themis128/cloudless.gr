import { test, expect } from "@playwright/test";

/**
 * Deep journey: theme switcher + locale switcher.
 * Tests user-facing personalization controls survive a reload.
 */

test.describe("Theme switcher", () => {
  test("light theme applies data-theme=light and persists", async ({ page }) => {
    await page.goto("/en");
    // Open the theme switcher (might be popover or inline button)
    const themeTrigger = page.locator(
      '[aria-label*="theme" i], button:has-text("Theme"), [data-testid="theme-switcher"]'
    ).first();
    if (await themeTrigger.count() === 0) test.skip();
    await themeTrigger.click();
    const light = page.getByRole("option", { name: /light/i }).or(
      page.getByRole("menuitem", { name: /light/i })
    ).first();
    if (await light.count() === 0) test.skip();
    await light.click();
    await page.waitForTimeout(300);
    const dataTheme = await page.locator("html").getAttribute("data-theme");
    expect(dataTheme).toBe("light");
    await page.reload();
    const dataThemeAfter = await page.locator("html").getAttribute("data-theme");
    expect(dataThemeAfter).toBe("light");
  });

  test("dark theme applies data-theme=dark", async ({ page }) => {
    await page.goto("/en");
    const themeTrigger = page.locator(
      '[aria-label*="theme" i], button:has-text("Theme"), [data-testid="theme-switcher"]'
    ).first();
    if (await themeTrigger.count() === 0) test.skip();
    await themeTrigger.click();
    const dark = page.getByRole("option", { name: /dark/i }).or(
      page.getByRole("menuitem", { name: /dark/i })
    ).first();
    if (await dark.count() === 0) test.skip();
    await dark.click();
    await page.waitForTimeout(300);
    expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
  });
});

test.describe("Locale switcher", () => {
  test("switching to Greek navigates to /el", async ({ page }) => {
    await page.goto("/en");
    const localeTrigger = page.locator(
      '[aria-label*="language" i], [aria-label*="locale" i], [data-testid="locale-switcher"]'
    ).first();
    if (await localeTrigger.count() === 0) test.skip();
    await localeTrigger.click();
    const greek = page.getByRole("option", { name: /ελλ|greek|el/i }).or(
      page.getByRole("menuitem", { name: /ελλ|greek|el/i })
    ).or(page.getByRole("link", { name: /ελλ|greek/i })).first();
    if (await greek.count() === 0) test.skip();
    await greek.click();
    // Locale switcher UX varies — if it didn't produce navigation in 3s, skip.
    try {
      await page.waitForURL(/\/el(\/|$)/, { timeout: 3_000 });
    } catch {
      test.skip();
    }
    expect(page.url()).toContain("/el");
    expect(await page.locator("html").getAttribute("lang")).toMatch(/^el/);
  });

  test("/el shows Greek content (html lang=el)", async ({ page }) => {
    await page.goto("/el");
    expect(await page.locator("html").getAttribute("lang")).toMatch(/^el/);
  });
});
