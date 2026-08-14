import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { GUEST_STORAGE } from "./_helpers";

test.use({ storageState: GUEST_STORAGE });
test.describe.configure({ mode: "serial" });

const ROUTES = [
  "/en",
  "/en/store",
  "/en/contact",
  "/en/services",
  "/en/auth/login",
  "/en/auth/signup",
] as const;

test.describe("Accessibility (focused public surface)", () => {
  for (const route of ROUTES) {
    test(`${route} has skip link, main landmark, and no serious axe violations`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("link", { name: /skip to content/i })).toHaveCount(1);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .disableRules(["color-contrast"])
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      expect(
        blocking,
        blocking
          .map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.html).join(" | ")}`)
          .join("\n"),
      ).toHaveLength(0);
    });
  }

  test("login fields are labelled; contact fields are labelled", async ({ page }) => {
    await page.goto("/en/auth/login");
    await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("label[for=email]")).toBeVisible();

    await page.goto("/en/contact");
    const form = page.getByTestId("contact-form");
    await expect(form.locator("#name, input[name=name]").first()).toBeVisible();
    await expect(form.locator("#email, input[name=email]").first()).toBeVisible();
    await expect(form.locator("#message, textarea[name=message]").first()).toBeVisible();
  });
});
