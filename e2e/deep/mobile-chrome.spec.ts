import { test, expect, devices } from "@playwright/test";
import { GUEST_STORAGE } from "./_helpers";
import { openMobileNavIfNeeded, closeMobileNavIfOpen } from "../helpers/mobile-nav";

// CI e2e-full-coverage only runs --project=chromium (desktop). This file is
// mobile chrome smoke, so pin Pixel 7 or the hamburger stays lg:hidden.
test.use({
  ...devices["Pixel 7"],
  storageState: GUEST_STORAGE,
});

test.describe("Mobile chrome smoke", () => {
  test("hamburger, cart tap target, and chat panel fit the viewport", async ({ page }) => {
    await page.goto("/en/store");
    await openMobileNavIfNeeded(page);
    await expect(page.getByTestId("mobile-menu-button")).toBeVisible();

    const cart = page.getByTestId("cart").filter({ visible: true }).first();
    await expect(cart).toBeVisible();
    const box = await cart.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);

    await closeMobileNavIfOpen(page);

    const chatFab = page.getByRole("button", { name: /open chat assistant/i });
    await expect(chatFab).toBeVisible();

    const cookieBanner = page.getByTestId("cookie-banner");
    // Banner mounts after requestIdleCallback (up to 2s). Wait for it when
    // guest storage has no consent, then assert the FAB sits above it.
    await cookieBanner.waitFor({ state: "visible", timeout: 8_000 }).catch(() => undefined);
    if (await cookieBanner.isVisible().catch(() => false)) {
      await expect
        .poll(async () => {
          const fabBox = await chatFab.boundingBox();
          const bannerBox = await cookieBanner.boundingBox();
          if (!fabBox || !bannerBox) return false;
          return fabBox.y + fabBox.height <= bannerBox.y + 1;
        })
        .toBe(true);
    }

    await chatFab.click();
    const panel = page.getByTestId("chat-panel");
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    const viewport = page.viewportSize();
    expect(panelBox).toBeTruthy();
    expect(viewport).toBeTruthy();
    if (panelBox && viewport) {
      expect(panelBox.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(panelBox.x).toBeGreaterThanOrEqual(-1);
    }
  });
});
