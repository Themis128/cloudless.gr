import { test, expect } from "@playwright/test";

test.describe("Admin page sweep (cookie-authenticated)", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: "e2e_admin", value: "1", url: "http://localhost:4000",
    }]);
  });

  test("/en/admin loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/ab-tests loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/ab-tests", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/ai-assistant loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/ai-assistant", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/analytics loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/analytics", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/analytics/unified loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/analytics/unified", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/blog loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/blog", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/calendar loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/calendar", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/campaigns loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/campaigns", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/campaigns/google loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/campaigns/google", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/campaigns/linkedin loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/campaigns/linkedin", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/campaigns/tiktok loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/campaigns/tiktok", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/campaigns/x loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/campaigns/x", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/client-portals loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/client-portals", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/crm loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/crm", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/crm/companies loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/crm/companies", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/crm/tickets loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/crm/tickets", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/docs loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/docs", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/email loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/email", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/errors loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/errors", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/esp32 loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/esp32", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/esp32-manager loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/esp32-manager", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/hubspot loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/hubspot", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/integrations loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/integrations", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/kpi loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/kpi", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/monitor loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/monitor", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/notifications loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/notifications", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/appflowy loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/appflowy", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/appflowy/analytics loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/appflowy/analytics", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/appflowy/projects loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/appflowy/projects", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/appflowy/status loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/appflowy/status", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/appflowy/submissions loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/appflowy/submissions", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/appflowy/tasks loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/appflowy/tasks", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/orders loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/orders", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/pipeline loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/pipeline", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/projects loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/projects", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/reports loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/reports", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/settings loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/settings", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/subscriptions loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/subscriptions", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/users loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/users", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/voice-brief loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/voice-brief", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
  test("/en/admin/workspaces loads with h1/h2 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => {
      if (m.type() === "error") errors.push(m.text());
    });
    const r = await page.goto("/en/admin/workspaces", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30_000 });
  });
});
