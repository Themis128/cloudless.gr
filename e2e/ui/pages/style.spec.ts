import { test, expect, type Page } from "@playwright/test";

/**
 * Light design-system smoke — pages render with styled chrome.
 * Does not hard-require scanlines / cyber-grid / neon class presence.
 */

const PAGES = [
  { path: "/en", name: "Homepage" },
  { path: "/en/services", name: "Services" },
  { path: "/en/store", name: "Store" },
  { path: "/en/blog", name: "Blog" },
  { path: "/en/contact", name: "Contact" },
] as const;

async function hasStyledChrome(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    const customProps = [...styles].some((p) => p.startsWith("--"));
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const transparent =
      !bodyBg ||
      bodyBg === "transparent" ||
      bodyBg === "rgba(0, 0, 0, 0)" ||
      bodyBg === "rgba(0,0,0,0)";
    return customProps || !transparent;
  });
}

test.describe("Style System (smoke)", () => {
  for (const { path, name } of PAGES) {
    test(`${name} has main, heading, and styled chrome`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
      expect(await hasStyledChrome(page)).toBeTruthy();
    });
  }
});
