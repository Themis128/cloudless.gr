import { test, expect } from "@playwright/test";
import { GUEST_STORAGE } from "./_helpers";
import { openMobileNavIfNeeded } from "../helpers/mobile-nav";

test.use({ storageState: GUEST_STORAGE });

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

    await page.getByRole("button", { name: /open chat assistant/i }).click();
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
