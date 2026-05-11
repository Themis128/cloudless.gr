import { test, expect } from "@playwright/test";

test.describe("Contact form API", () => {
  test("POST /api/contact with missing fields returns 400", async ({ request }) => {
    const res = await request.post("/api/contact", {
      data: {},
    });
    // Must reject incomplete submissions
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("POST /api/contact with invalid email returns 400", async ({ request }) => {
    const res = await request.post("/api/contact", {
      data: { name: "Test", email: "not-an-email", message: "Hello" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });
});
