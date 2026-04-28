import { test, expect } from "@playwright/test";

test.describe("Contact & Integrations", () => {
  test("contact form renders the documented fields", async ({ page }) => {
    await page.goto("/contact");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel(/name/i).first()).toBeVisible();
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expect(page.getByLabel(/message/i).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send|submit/i })
    ).toBeVisible();
  });

  test("contact form submit posts to /api/contact and shows success", async ({ page }) => {
    await page.route("**/api/contact", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, eventId: "test-event" }),
      })
    );

    await page.goto("/contact");
    await page.getByLabel(/name/i).first().fill("Playwright User");
    await page.getByLabel(/email/i).first().fill("playwright@example.com");
    await page.getByLabel(/message/i).first().fill("Hello from the e2e suite.");
    await page
      .getByLabel(/agree|consent|privacy/i)
      .first()
      .check();
    await page.getByRole("button", { name: /send|submit/i }).click();

    await expect(page.getByText(/sent successfully|thank you/i)).toBeVisible();
  });

  test("legal pages render with a heading", async ({ page }) => {
    for (const path of ["/privacy", "/terms", "/cookies"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });
});
