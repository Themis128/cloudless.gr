/**
 * Performance budgets — first-paint and core navigation timing.
 *
 * `performance.spec.ts` exists but only smoke-checks navigation timing.
 * This spec pins explicit budgets for the three pages that take the
 * brunt of organic traffic. Budgets are intentionally generous —
 * Lighthouse runs against production and is the authoritative perf
 * gate; this spec catches catastrophic dev-mode regressions (an N+1
 * fetch that compounds, a heavy synchronous import landing on the
 * critical path) before they reach a Lighthouse run.
 *
 * Metrics used: Navigation Timing L2 + Paint Timing — both are
 * available in Chromium without any extra protocol setup.
 *
 * Budgets (dev server, generous):
 *   - DOMContentLoaded < 8s
 *   - load < 12s
 *   - first-contentful-paint < 6s
 *
 * If any of these are blown the test fails AND logs the actual numbers
 * so the regression is immediately diagnosable.
 */
import { test, expect } from "@playwright/test";

type PerfMetrics = {
  domContentLoadedMs: number;
  loadMs: number;
  firstContentfulPaintMs: number | null;
};

async function collectMetrics(page: import("@playwright/test").Page): Promise<PerfMetrics> {
  return await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const fcp = performance
      .getEntriesByType("paint")
      .find(e => e.name === "first-contentful-paint");
    return {
      domContentLoadedMs: nav?.domContentLoadedEventEnd ?? 0,
      loadMs: nav?.loadEventEnd ?? 0,
      firstContentfulPaintMs: fcp ? fcp.startTime : null,
    };
  });
}

const BUDGETS = {
  domContentLoadedMs: 8_000,
  loadMs: 12_000,
  firstContentfulPaintMs: 6_000,
} as const;

const PAGES = ["/en/", "/en/blog", "/en/services"] as const;

test.describe.configure({ mode: "serial" });
test.setTimeout(40_000);

for (const url of PAGES) {
  test.describe(`Performance: ${url}`, () => {
    test("meets dev-server budgets", async ({ page }) => {
      await page.goto(url, { waitUntil: "load" });
      // Wait one extra rAF so paint metrics flush.
      await page.evaluate(
        () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(0)))),
      );

      const m = await collectMetrics(page);

      // Log on the report so a CI failure is self-diagnosing.
      console.log(`[perf] ${url}`, m);

      expect(m.domContentLoadedMs, "DOMContentLoaded budget").toBeLessThan(
        BUDGETS.domContentLoadedMs,
      );
      expect(m.loadMs, "load event budget").toBeLessThan(BUDGETS.loadMs);
      if (m.firstContentfulPaintMs != null) {
        expect(m.firstContentfulPaintMs, "FCP budget").toBeLessThan(
          BUDGETS.firstContentfulPaintMs,
        );
      }
    });
  });
}
