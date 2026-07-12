/**
 * Admin page gap coverage — covers admin pages missing from admin-pages-sweep.spec.ts
 *
 * These pages were added after the original sweep was generated:
 * - /en/admin/appflowy
 * - /en/admin/audits
 * - /en/admin/automation
 * - /en/admin/cluster
 * - /en/admin/cost
 * - /en/admin/grafana
 * - /en/admin/langgraph
 * - /en/admin/selfhosted
 * - /en/admin/n8n
 * - /en/admin/pending-clients
 * - /en/admin/search/reindex
 */
import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.setTimeout(45_000);

const ADMIN_GAPS = [
  "/en/admin/appflowy",
  "/en/admin/audits/latest",
  "/en/admin/automation",
  "/en/admin/cluster/kuma-status",
  "/en/admin/cluster/mqtt-status",
  "/en/admin/cluster/watchdogs",
  "/en/admin/cost",
  "/en/admin/grafana/dashboards",
  "/en/admin/grafana/datasources",
  "/en/admin/grafana/health",
  "/en/admin/grafana/prometheus",
  "/en/admin/langgraph",
  "/en/admin/n8n/workflows",
  "/en/admin/n8n/health",
  "/en/admin/n8n/executions",
  "/en/admin/pending-clients",
  "/en/admin/search/reindex",
];

test.describe("Admin page gap sweep (cookie-authenticated)", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: "e2e_admin", value: "1", url: "http://localhost:4000",
    }]);
  });

  for (const route of ADMIN_GAPS) {
    test(`${route} loads with h1/h2 and no console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", e => errors.push(e.message));
      page.on("console", m => {
        if (m.type() === "error") errors.push(m.text());
      });
      const r = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBeLessThan(500);
      await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
    });
  }
});