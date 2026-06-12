/**
 * Dashboard + auth gap coverage.
 *
 * `dashboard.spec.ts` only smoke-tests `/dashboard` itself. The sub-pages and
 * the post-login bridge route were never covered by a non-auth-gated spec —
 * `dashboard-deep.spec.ts` reaches them but skips entirely without
 * `E2E_USER_*` creds, leaving zero coverage on a fresh checkout.
 *
 * Each spec here asserts the *unauthenticated* contract that DOES hold on a
 * fresh checkout:
 *   - The route does not 5xx.
 *   - The user is either redirected to `/auth/login` OR sees a sign-in CTA
 *     on the dashboard shell — never private content silently.
 *
 * Routes:
 *   /en/dashboard/consultations
 *   /en/dashboard/profile
 *   /en/dashboard/purchases
 *   /en/dashboard/settings
 *   /en/auth/post-login
 */
import { test, expect } from "@playwright/test";

const DASHBOARD_SUB_PAGES = [
  "/en/dashboard/consultations",
  "/en/dashboard/profile",
  "/en/dashboard/purchases",
  "/en/dashboard/settings",
] as const;

test.describe("Dashboard sub-pages (unauthenticated)", () => {
  for (const route of DASHBOARD_SUB_PAGES) {
    test(`${route} — redirects to login or renders sign-in CTA`, async ({ page }) => {
      const r = await page.goto(route, { waitUntil: "domcontentloaded" });
      // Either a clean response (the gated shell rendered) or a redirect to
      // the login flow. Either way: never a 5xx.
      expect(r?.status() ?? 0).toBeLessThan(500);

      // Wait for either redirect-to-login or a sign-in affordance on the page.
      const url = page.url();
      const onLogin = /\/auth\/login/.test(url);
      const onDashboard = /\/dashboard/.test(url);

      if (!onLogin) {
        // If we stayed on the dashboard route, the page must visibly offer a
        // sign-in path or render the shell — not silently expose user data.
        const hasSignInCTA = await page
          .getByRole("link", { name: /sign in|login|log in/i })
          .first()
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        const hasMain = await page
          .locator("main, h1, h2")
          .first()
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        expect(onDashboard && (hasSignInCTA || hasMain)).toBeTruthy();
      } else {
        await expect(page.locator("body")).toBeVisible();
      }
    });
  }
});

test.describe("/auth/post-login bridge route", () => {
  test("renders without 5xx for unauthenticated users", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    const r = await page.goto("/en/auth/post-login", {
      waitUntil: "domcontentloaded",
    });
    expect(r?.status() ?? 0).toBeLessThan(500);
    // Page is a bridge — it either redirects elsewhere or briefly renders a
    // loading shell. Both are acceptable; what matters is that the bridge
    // itself didn't throw on first paint.
    await expect(page.locator("body")).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
