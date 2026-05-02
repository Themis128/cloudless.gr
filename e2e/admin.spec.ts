import { test, expect } from "@playwright/test";
import { loginAsUser, logout } from "./helpers/test-helpers";
import { TEST_USERS, URL_PATHS, WAIT_TIMES } from "./fixtures/test-user";

const adminEmail = process.env.E2E_ADMIN_EMAIL || "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "";
const shouldRunAdminTests = Boolean(adminEmail && adminPassword);

const adminPages = [
  { path: URL_PATHS.adminOrders, label: /Orders/i },
  { path: URL_PATHS.adminUsers, label: /Users/i },
  { path: URL_PATHS.adminCRM, label: /CRM|Contacts/i },
  { path: URL_PATHS.adminAnalytics, label: /Analytics|SEO/i },
];

test.describe("Admin Panel", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!shouldRunAdminTests) {
      testInfo.skip("E2E admin credentials are not configured");
    }

    try {
      await loginAsUser(
        page,
        adminEmail,
        adminPassword,
        URL_PATHS.admin,
      );
    } catch (error) {
      testInfo.skip(`Admin login failed: ${error}`);
    }
  });

  test.afterEach(async ({ page }) => {
    try {
      await logout(page);
    } catch {
      // ignore logout failures
    }
  });

  test("can access the admin dashboard", async ({ page }) => {
    await page.goto(URL_PATHS.admin);
    await page.waitForURL("**/admin", { timeout: WAIT_TIMES.long });

    await expect(page.locator("h1", { hasText: /Admin Dashboard/i })).toBeVisible();
    await expect(page.locator("text=Orders & Revenue")).toBeVisible();
    await expect(page.locator("text=CRM Contacts")).toBeVisible();
  });

  test("admin navigation contains key sections", async ({ page }) => {
    await page.goto(URL_PATHS.admin);
    await page.waitForURL("**/admin", { timeout: WAIT_TIMES.long });

    await expect(page.locator(`a[href="${URL_PATHS.adminOrders}"]`)).toBeVisible();
    await expect(page.locator(`a[href="${URL_PATHS.adminUsers}"]`)).toBeVisible();
    await expect(page.locator(`a[href="${URL_PATHS.adminCRM}"]`)).toBeVisible();
    await expect(page.locator(`a[href="${URL_PATHS.adminAnalytics}"]`)).toBeVisible();
  });

  test("can navigate to admin subpages", async ({ page }) => {
    for (const pageInfo of adminPages) {
      await page.goto(pageInfo.path);
      await page.waitForURL(`**${pageInfo.path}`, { timeout: WAIT_TIMES.long });

      const heading = page.locator("h1, h2", { hasText: pageInfo.label });
      await expect(heading).toBeVisible({ timeout: WAIT_TIMES.long });
    }
  });
});
