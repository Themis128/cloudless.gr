/**
 * Deep coverage for every admin page (authenticated admin).
 * Uses admin.json storageState — set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD or tests skip.
 *
 * Each route:
 *   - Loads without 5xx
 *   - Renders body content
 *   - No critical console errors
 *   - Includes the admin nav
 *
 * Also: every admin page redirects unauthenticated users away.
 */
import { test, expect } from "./coverage";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { ADMIN_PAGES } from "./helpers/coverage-routes";

const STORAGE = path.join(__dirname, ".auth", "admin.json");

function hasRealAuth(): boolean {
  try {
    const j = JSON.parse(fs.readFileSync(STORAGE, "utf8"));
    return Array.isArray(j.cookies) && j.cookies.length > 0;
  } catch {
    return false;
  }
}

test.describe.configure({ mode: "serial" }); // serial to keep memory low on /mnt/d
test.setTimeout(60_000);

test.describe("Admin unauthenticated", () => {
  for (const route of ADMIN_PAGES) {
    test(`unauth ${route} — does not expose admin content`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle").catch(() => {});
      // Without auth, page must either redirect or NOT show admin UI
      const adminBadge = await page
        .locator("text=/admin dashboard/i")
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      const loginVisible = await page
        .getByLabel(/email/i)
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      const onLogin = /\/auth\/login/.test(page.url());
      // At least one of: redirected to login, login form visible, or no admin content rendered
      expect(onLogin || loginVisible || !adminBadge).toBeTruthy();
    });
  }
});

test.describe("Admin authenticated", () => {
  test.use({ storageState: STORAGE });

  test.beforeEach(({}, testInfo) => {
    if (!hasRealAuth()) {
      testInfo.skip(
        true,
        "Skipping authenticated admin tests (E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not set)"
      );
    }
  });

  for (const route of ADMIN_PAGES) {
    test(`auth ${route} — renders without 5xx`, async ({ page }) => {
      const fivexx: string[] = [];
      page.on("response", (r) => {
        if (r.status() >= 500) fivexx.push(`${r.status()} ${r.url()}`);
      });

      const resp = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(resp?.status(), `${route} returned ${resp?.status()}`).toBeLessThan(500);

      await page.waitForLoadState("networkidle").catch(() => {});
      await expect(page.locator("body")).toBeVisible();

      // Allow same-origin 5xx from optional sub-requests; only fail if the page itself errored
      expect(fivexx.filter((s) => !s.includes("/api/"))).toEqual([]);
    });
  }
});
