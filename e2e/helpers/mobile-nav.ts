import { expect, type Page } from "@playwright/test";

/**
 * Pixel / <lg viewports hide desktop nav (`hidden lg:flex`). Links live in the
 * hamburger drawer — open it before clicking nav items.
 */
export async function openMobileNavIfNeeded(page: Page): Promise<void> {
  const hamburger = page.getByTestId("mobile-menu-button");
  if (!(await hamburger.isVisible().catch(() => false))) return;

  const drawerOpen = async (): Promise<boolean> =>
    (await hamburger.getAttribute("aria-expanded")) === "true" &&
    (await page.getByTestId("mobile-menu").isVisible().catch(() => false));

  if (await drawerOpen()) return;

  for (let attempt = 0; attempt < 3; attempt++) {
    await hamburger.click({ force: true });
    try {
      await expect(hamburger).toHaveAttribute("aria-expanded", "true", { timeout: 4_000 });
      await expect(page.getByTestId("mobile-menu")).toBeVisible({ timeout: 4_000 });
      return;
    } catch {
      // Drawer animation / first-click swallow — retry.
    }
  }

  await expect(hamburger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("mobile-menu")).toBeVisible();
}

export async function clickNavHref(page: Page, hrefPart: string): Promise<void> {
  const escaped = hrefPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const dest = new RegExp(`/(?:en|el|fr|de)${escaped}(?:/)?(?:\\?.*)?$`);

  for (let attempt = 0; attempt < 2; attempt++) {
    await openMobileNavIfNeeded(page);
    const hamburgerVisible = await page.getByTestId("mobile-menu-button").isVisible();
    const root = hamburgerVisible
      ? page.getByTestId("mobile-menu")
      : page.getByTestId("main-nav");
    const link = root.locator(`a[href*="${hrefPart}"]`).filter({ visible: true }).first();
    await expect(link).toBeVisible({ timeout: 10_000 });
    await link.click({ force: true });
    try {
      await expect(page).toHaveURL(dest, { timeout: 12_000 });
      return;
    } catch (err) {
      if (attempt === 1) throw err;
      await page.waitForLoadState("domcontentloaded").catch(() => {});
    }
  }
}
