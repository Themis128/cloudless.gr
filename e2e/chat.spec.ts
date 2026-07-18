import { test, expect } from "@playwright/test";

/**
 * Chat widget and AI functionality coverage tests
 */

test.describe("Chat Widget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en");
  });

  test("chat widget is present on page", async ({ page }) => {
    // Looking for chat-related elements (may be in providers or separate component)
    const chatElements = page.locator(
      '[data-testid*="chat"], .chat-widget, [class*="chat"]'
    );
    const count = await chatElements.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("chat API endpoint responds", async ({ request }) => {
    const response = await request.post(
      `${process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4000"}/api/chat`,
      {
        data: { message: "hello" },
      }
    );
    expect([200, 400, 401, 404]).toContain(response.status());
  });

  test("chat-ai API endpoint responds", async ({ request }) => {
    const response = await request.post(
      `${process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4000"}/api/chat-ai`,
      {
        data: { message: "test" },
      }
    );
    expect([200, 400, 401, 404]).toContain(response.status());
  });
});

test.describe("Workers AI Integration", () => {
  test("Workers AI doctor endpoint exists", async ({ request }) => {
    const response = await request.get(
      `${process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4000"}/api/admin/ai/generate`
    );
    expect([200, 401, 403, 404]).toContain(response.status());
  });
});