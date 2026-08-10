import { test, expect } from "@playwright/test";
import { adminRequest } from "./admin-api.test";

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
    test(`GET ${endpoint} should return non-5xx status for admin`, async ({ page }) => {
      const response = await page.evaluate(async (endpoint) => {
        const req = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test-admin-session'
          }
        });
        return {
          status: req.status,
          ok: req.ok
        };
      }, endpoint);

      expect(response.status).not.toBe(500);
      expect(response.status).not.toBe(502);
      expect(response.status).not.toBe(503);
      expect(response.status).not.toBe(504);
      expect(response.ok).toBe(true);
    });
  });

  test.afterAll(async () => {
    // Cleanup after tests
  });
});
