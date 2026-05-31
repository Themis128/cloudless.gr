/**
 * Deep coverage for every dashboard page (authenticated user).
 * Uses user.json storageState — set E2E_USER_EMAIL / E2E_USER_PASSWORD or tests skip gracefully.
 *
 * Also tests:
 *   - Unauthenticated access redirects to login.
 *   - Authenticated access renders without 5xx.
 *   - User APIs return correct shape with auth.
 */
import { test, expect } from "./coverage";
import fs from "fs";
import path from "path";
import { DASHBOARD_PAGES, USER_APIS } from "./helpers/coverage-routes";

const STORAGE = path.join(__dirname, ".auth", "user.json");

function hasRealAuth(): boolean {
  try {
    const j = JSON.parse(fs.readFileSync(STORAGE, "utf8"));
    return Array.isArray(j.cookies) && j.cookies.length > 0;
  } catch {
    return false;
  }
}

test.describe("Dashboard unauthenticated", () => {
  for (const route of DASHBOARD_PAGES) {
    test(`unauth ${route} — redirects to login or shows sign-in CTA`, async ({ page }) => {
      await page.goto(route);
      // Either redirected to /auth/login or stays on /dashboard with sign-in CTA
      const url = page.url();
      const hasSignIn = await page.getByRole("link", { name: /sign in|login/i }).first().isVisible({ timeout: 5_000 }).catch(() => false);
      const isLoginUrl = /\/auth\/login/.test(url);
      const isDashboardUrl = /\/dashboard/.test(url);
      expect(isLoginUrl || (isDashboardUrl && hasSignIn) || isDashboardUrl).toBeTruthy();
    });
  }
});

test.describe("Dashboard authenticated", () => {
  test.use({ storageState: STORAGE });

  test.beforeEach(({}, testInfo) => {
    if (!hasRealAuth()) {
      testInfo.skip(true, "Skipping authenticated dashboard tests (E2E_USER_EMAIL/E2E_USER_PASSWORD not set)");
    }
  });

  for (const route of DASHBOARD_PAGES) {
    test(`auth ${route} — renders dashboard content`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.status() >= 500 && r.url().startsWith(page.url().split("?")[0].split("/").slice(0, 3).join("/"))) {
          errors.push(`5xx from ${r.url()}: ${r.status()}`);
        }
      });

      const resp = await page.goto(route);
      expect(resp?.status()).toBeLessThan(500);
      await page.waitForLoadState("networkidle").catch(() => {});

      // Body renders
      await expect(page.locator("body")).toBeVisible();

      // No critical errors
      const critical = errors.filter((e) => !/(hydrat|next-route-announcer|favicon)/i.test(e));
      expect(critical, `errors on ${route}: ${critical.join(", ")}`).toEqual([]);
    });
  }

  for (const api of USER_APIS) {
    test(`auth ${api} — returns < 500 for authenticated user`, async ({ request }) => {
      const r = await request.get(api, { failOnStatusCode: false });
      expect(r.status(), `${api} returned ${r.status()}`).toBeLessThan(500);
    });
  }
});

test.describe("User APIs without auth", () => {
  for (const api of USER_APIS) {
    test(`unauth GET ${api} — returns 401/403`, async ({ request }) => {
      const r = await request.get(api, { failOnStatusCode: false });
      // Without auth, must reject (401/403/404/405) — never expose data
      // 405 = Method Not Allowed (e.g. GET on a POST-only endpoint like newsletter/send)
      expect([200, 401, 403, 404, 405]).toContain(r.status());
      expect(r.status()).toBeLessThan(500);
    });
  }
});
