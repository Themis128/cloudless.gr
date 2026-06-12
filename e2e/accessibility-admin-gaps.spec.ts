/**
 * Accessibility audit — admin pages added since PR #826.
 *
 * `accessibility.spec.ts` only iterates `PUBLIC_PAGES`. The admin surface
 * never had axe coverage. Auditing the entire admin nav at once is slow
 * (heavy DOM, lots of widgets), so this spec targets the pages that
 * shipped without any a11y check — the same ones PR #826 added smoke
 * coverage for plus the CMS pages that ship a real form/table.
 *
 * Contract per page (same as `accessibility.spec.ts`):
 *   - axe-core, WCAG 2.1 AA tags
 *   - color-contrast disabled (dev mode false positives — Lighthouse
 *     handles the authoritative check in production)
 *   - zero critical/serious violations
 *
 * Uses the existing e2e_admin cookie bypass so the auth gate doesn't
 * block the audit.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const ADMIN_PAGES_A11Y = [
  "/en/admin/ai-generator",
  "/en/admin/analytics/seo",
  "/en/admin/campaigns/meta",
  "/en/admin/cms/case-studies",
  "/en/admin/cms/faqs",
  "/en/admin/cms/services",
  "/en/admin/cms/testimonials",
  "/en/admin/email/campaigns",
  "/en/admin/leads",
] as const;

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
      v =>
        `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n` +
        v.nodes
          .slice(0, 3)
          .map(
            n =>
              `  → ${n.html.slice(0, 120)}\n    ${n.failureSummary ?? ""}`,
          )
          .join("\n"),
    )
    .join("\n\n");
}

for (const route of ADMIN_PAGES_A11Y) {
  test.describe(`Admin a11y: ${route}`, () => {
    test.beforeEach(async ({ context }) => {
      await context.addCookies([{
        name: "e2e_admin",
        value: "1",
        url: "http://localhost:4000",
      }]);
    });

    test("WCAG 2.1 AA — zero critical/serious violations", async ({ page }) => {
      const r = await page.goto(route, { waitUntil: "domcontentloaded" });
      // If the page itself 5xx'd, the a11y check is moot — that's a
      // separate failure already caught by admin-pages-gaps-sweep.
      if (!r || r.status() >= 500) {
        test.skip(true, `${route} returned ${r?.status() ?? "no response"}`);
      }

      // Wait for the page's main heading/region — not every admin page
      // has <main>, some use h1 + a div grid.
      await page
        .locator("h1, h2, main, [role=\"main\"], [role=\"alert\"]")
        .first()
        .waitFor({ state: "visible", timeout: 20_000 });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        // Same exclusions as accessibility.spec.ts
        .exclude("#hubspot-messages-iframe-container")
        .disableRules(["color-contrast"])
        .analyze();

      const blocking = results.violations.filter(
        v => v.impact && FAILING_IMPACTS.has(v.impact),
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
  });
}
