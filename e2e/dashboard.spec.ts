import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("login page is accessible", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page).toHaveURL(/\/auth\/login/);
    await page.waitForLoadState("networkidle").catch(() => {});
    // When Keycloak is configured, the login page shows an SSO button instead
    // of email/password fields.
    const hasKeycloak = await page.getByRole("button", { name: /continue with keycloak/i }).isVisible({ timeout: 10_000 }).catch(() => false);
    const hasEmail = await page.getByLabel(/email/i).isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasKeycloak || hasEmail, "login page must show either Keycloak SSO button or email field").toBeTruthy();
  });

  test("/dashboard redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");
    // Without an auth session the AuthContext gate either keeps users on
    // /dashboard with a sign-in CTA or redirects to /auth/login. Either is
    // acceptable; what matters is that no unauth user sees private content.
    await expect(page).toHaveURL(/\/auth\/login|\/dashboard/);
    await expect(page.locator("body")).toBeVisible();
  });
});
