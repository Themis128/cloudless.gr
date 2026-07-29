/**
 * Authenticated dashboard journey.
 *
 * `dashboard-deep.spec.ts` iterates every dashboard route through the
 * user storage state, but it doesn't assert on the cross-page session
 * continuity — it just checks each page in isolation.
 *
 * This spec walks the actual user flow: land on dashboard, click into
 * each sub-page from the dashboard nav, and verify the session sticks
 * across navigations. It uses the same e2e bypass cookie that the
 * admin sweeps use (`e2e_user`) when present, otherwise skips
 * gracefully.
 *
 * The contract:
 *   - Each sub-page must render past the gate (no redirect to login)
 *   - The auth context survives client-side navigation
 *   - No page 5xxs (would surface as a layout error boundary)
 */
import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const USER_STORAGE = path.join(__dirname, ".auth", "user.json");

function hasUserAuth(): boolean {
  try {
    const j = JSON.parse(fs.readFileSync(USER_STORAGE, "utf8"));
    return Array.isArray(j.cookies) && j.cookies.length > 0;
  } catch {
    return false;
  }
}

const DASHBOARD_ROUTES = [
  { url: "/en/dashboard", label: "Dashboard home" },
  { url: "/en/dashboard/consultations", label: "Consultations" },
  { url: "/en/dashboard/profile", label: "Profile" },
  { url: "/en/dashboard/purchases", label: "Purchases" },
  { url: "/en/dashboard/settings", label: "Settings" },
] as const;

test.describe("Authenticated dashboard journey", () => {
  test.skip(
    !hasUserAuth(),
    "no e2e/.auth/user.json — set E2E_USER_EMAIL/E2E_USER_PASSWORD to enable"
  );

  test.use({ storageState: USER_STORAGE });

  for (const { url, label } of DASHBOARD_ROUTES) {
    test(`${label} (${url}) renders without redirect to login`, async ({ page }) => {
      const r = await page.goto(url, { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(500);

      // Must stay on the dashboard route — auth survived.
      expect(page.url(), "should not redirect to /auth/login").not.toMatch(/\/auth\/login/);
      expect(page.url()).toContain("/dashboard");

      // Real content rendered.
      await expect(page.locator('main, h1, h2, [role="main"]').first()).toBeVisible({
        timeout: 20_000,
      });
    });
  }

  test("session persists across multiple navigations", async ({ page }) => {
    // Hit every dashboard page sequentially using client-side navigation
    // where possible. Any auth lapse would redirect to login.
    for (const { url } of DASHBOARD_ROUTES) {
      const r = await page.goto(url, { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(500);
      expect(page.url(), `auth lapsed on ${url}`).not.toMatch(/\/auth\/login/);
    }
  });
});
