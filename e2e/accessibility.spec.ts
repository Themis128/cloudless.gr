/**
 * Accessibility audit — WCAG 2.1 AA via axe-core.
 *
 * Each route is checked for:
 *   - Zero critical / serious violations (fails the run)
 *   - Moderate / minor violations are surfaced as annotations in the report
 *
 * axe tags used: wcag2a, wcag2aa, wcag21a, wcag21aa
 * Reference: https://www.deque.com/axe/core-documentation/api-documentation/#axe-core-tags
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Routes to audit on every PR
const ROUTES = ["/", "/en", "/services", "/contact", "/store", "/blog"];

// Impact levels that will fail the test
const FAILING_IMPACTS = new Set(["critical", "serious"]);

type AxeViolation = {
  id: string;
  impact?: string;
  description: string;
  nodes: Array<{ html: string; failureSummary?: string }>;
};

function formatViolations(violations: AxeViolation[]): string {
  return violations
    .map(
      (v) =>
        `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n` +
        v.nodes
          .slice(0, 3)
          .map(
            (n) =>
              `  → ${n.html.slice(0, 120)}\n    ${n.failureSummary ?? ""}`,
          )
          .join("\n"),
    )
    .join("\n\n");
}

for (const route of ROUTES) {
  test.describe(`Accessibility: ${route}`, () => {
    test("WCAG 2.1 AA — zero critical/serious violations", async ({ page }) => {
      await page.goto(route);
      await page.waitForSelector("main", { timeout: 10_000 });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        // Exclude third-party embeds we cannot control
        .exclude("#hubspot-messages-iframe-container")
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact && FAILING_IMPACTS.has(v.impact),
      );

      if (blocking.length > 0) {
        console.error(
          `${blocking.length} critical/serious axe violation(s) on ${route}:\n\n` +
            formatViolations(blocking as AxeViolation[]),
        );
      }

      expect(
        blocking,
        `Expected zero critical/serious WCAG 2.1 AA violations on ${route}`,
      ).toHaveLength(0);
    });

    test("page has a non-empty <title>", async ({ page }) => {
      await page.goto(route);
      const title = await page.title();
      expect(
        title.trim().length,
        `<title> is empty on ${route}`,
      ).toBeGreaterThan(0);
    });

    test("page has exactly one <h1>", async ({ page }) => {
      await page.goto(route);
      await page.waitForSelector("main", { timeout: 10_000 });
      const h1Count = await page.locator("h1").count();
      expect(
        h1Count,
        `Expected exactly 1 <h1> on ${route}, found ${h1Count}`,
      ).toBe(1);
    });

    test("all images have alt attribute", async ({ page }) => {
      await page.goto(route);
      await page.waitForSelector("main", { timeout: 10_000 });

      // Images with alt="" are intentionally decorative — that is fine.
      // Images with no alt attribute at all are a hard failure.
      const missingAlt = await page
        .locator("img:not([alt])")
        .evaluateAll((imgs) =>
          imgs.map((img) =>
            (img as HTMLImageElement).outerHTML.slice(0, 200),
          ),
        );

      expect(
        missingAlt,
        `Images missing alt attribute on ${route}:\n${missingAlt.join("\n")}`,
      ).toHaveLength(0);
    });

    test("interactive elements are keyboard-focusable", async ({ page }) => {
      await page.goto(route);
      await page.waitForSelector("main", { timeout: 10_000 });

      const results = await new AxeBuilder({ page })
        .withRules([
          "tabindex",
          "focus-trap",
          "scrollable-region-focusable",
        ])
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact && FAILING_IMPACTS.has(v.impact),
      );

      expect(
        blocking,
        `Keyboard-focusability violations on ${route}:\n${formatViolations(blocking as AxeViolation[])}`,
      ).toHaveLength(0);
    });
  });
}
