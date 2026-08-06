import { test, expect } from "@playwright/test";

const adminApiEndpoints = [
  "/api/admin/ai/analytics",
  "/api/admin/ai/analytics/pdf",
  "/api/admin/ai/assistant",
  "/api/admin/ai/tools",
  "/api/admin/alerts",
  "/api/admin/analytics",
  "/api/admin/ab-tests",
];

test.describe("Admin API Endpoints", () => {
  test.beforeAll(async () => {
    // Setup any required state before tests run
  });

  adminApiEndpoints.forEach((endpoint) => {
    test(`GET ${endpoint} should return non-5xx status`, async ({ request }) => {
      const response = await request.get(endpoint);
      expect(response.status()).not.toBe(500);
      expect(response.status()).not.toBe(502);
      expect(response.status()).not.toBe(503);
      expect(response.status()).not.toBe(504);
    });
  });

  test.afterAll(async () => {
    // Cleanup after tests
  });
});