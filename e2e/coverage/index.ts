/**
 * Shared `test` export with an auto V8 coverage fixture.
 * Skips attachment when coverage arrays are empty (API-only tests).
 */
import { test as base, expect } from "@playwright/test";
import { addCoverageReport } from "monocart-reporter";

export const test = base.extend<{ _coverageAuto: void }>({
  _coverageAuto: [
    async ({ page, browserName }, use) => {
      const enabled = process.env.COVERAGE === "1" && browserName === "chromium";
      let started = false;
      if (enabled) {
        try {
          await Promise.all([
            page.coverage.startJSCoverage({ resetOnNavigation: false, reportAnonymousScripts: true }),
            page.coverage.startCSSCoverage({ resetOnNavigation: false }),
          ]);
          started = true;
        } catch { /* page is about:blank — skip */ }
      }
      await use();
      if (enabled && started) {
        try {
          const [js, css] = await Promise.all([
            page.coverage.stopJSCoverage(),
            page.coverage.stopCSSCoverage(),
          ]);
          const merged = [...js, ...css];
          // Only attach if we actually captured something — empty arrays
          // confuse monocart and clear the global cache.
          if (merged.length > 0) {
            await addCoverageReport(merged, test.info());
          }
        } catch { /* page closed — ignore */ }
      }
    },
    { scope: "test", auto: true },
  ],
});

export { expect };
