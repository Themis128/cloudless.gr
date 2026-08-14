import { expect, type Page } from "@playwright/test";

/**
 * Pixel / <lg viewports hide desktop nav (`hidden lg:flex`). Links live in the
 * hamburger drawer — open it before clicking nav items.
 */
export async function openMobileNavIfNeeded(page: Page): Promise<void> {
  const hamburger = page.getByTestId("mobile-menu-button");
  if (!(await hamburger.isVisible().catch(() => false))) return;
  if ((await hamburger.getAttribute("aria-expanded")) === "true") return;
  await hamburger.click({ force: true });
  await expect(
    page.getByTestId("main-nav").locator('a[href*="/services"]').filter({ visible: true }).first(),
  ).toBeVisible({ timeout: 10_000 });
}

export async function clickNavHref(page: Page, hrefPart: string): Promise<void> {
  await openMobileNavIfNeeded(page);
  const link = page
    .getByTestId("main-nav")
    .locator(`a[href*="${hrefPart}"]`)
    .filter({ visible: true })
    .first();
  await expect(link).toBeVisible({ timeout: 10_000 });
  await Promise.all([
    page.waitForURL((url) => url.pathname.includes(hrefPart), { timeout: 15_000 }),
    link.click({ force: true }),
  ]);
}
