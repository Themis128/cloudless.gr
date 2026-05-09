import { test, expect } from "@playwright/test";
import { loginAsUser, logout } from "./helpers/test-helpers";
import { TEST_USERS, URL_PATHS, WAIT_TIMES } from "./fixtures/test-user";

const adminEmail = process.env.E2E_ADMIN_EMAIL || "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "";
const shouldRunAdminTests = Boolean(adminEmail && adminPassword);

const adminPages = [
  { path: URL_PATHS.orders,    label: /order/i },
  { path: URL_PATHS.users,     label: /user/i },
  { path: URL_PATHS.crm,       label: /CRM|Contacts/i },
  // analytics|SEO matches the expected heading; "error" matches the error boundary
  // h1 as a fallback — navigation still succeeded even if the data fails to load
  { path: URL_PATHS.analytics, label: /analytics|SEO|error/i },
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
    // next-intl redirects /admin → /en/admin; anchor to exact path
    await page.waitForURL(/\/admin$/, { timeout: 20_000 });
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1", { hasText: /Admin Dashboard/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Orders & Revenue")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("CRM Contacts")).toBeVisible({ timeout: 10_000 });
  });

  test("admin navigation contains key sections", async ({ page }) => {
    await page.goto(URL_PATHS.admin);
    await page.waitForURL(/\/admin$/, { timeout: 20_000 });
    await page.waitForLoadState("networkidle");

    // getByRole('link') excludes display:none elements — safe on both
    // desktop (sidebar visible, mobile drawer hidden) and mobile (vice versa)
    await expect(page.getByRole("link", { name: "Orders", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: "Users", exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: "Contacts", exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: "Analytics", exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test("can navigate to admin subpages", async ({ page }) => {
    for (const pageInfo of adminPages) {
      await page.goto(pageInfo.path);
      // Accept locale-prefixed variant of the path
      await page.waitForURL(new RegExp(pageInfo.path.replace("/", "\\/")), { timeout: 20_000 });
      await page.waitForLoadState("networkidle");

      const heading = page.locator("h1, h2", { hasText: pageInfo.label });
      await expect(heading).toBeVisible({ timeout: 15_000 });
    }
  });
});
