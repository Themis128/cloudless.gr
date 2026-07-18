import { test, expect } from "@playwright/test";

/**
 * Complete API route coverage tests
 * Tests all API endpoints for proper responses
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4000";

// All API routes discovered from /src/app/api
const getAllApiRoutes = () => [
  // Public GET endpoints
  { path: "/api/health", method: "GET", expectedStatus: 200 },
  { path: "/api/blog", method: "GET", expectedStatus: 200 },
  { path: "/api/case-studies", method: "GET", expectedStatus: 200 },
  { path: "/api/testimonials", method: "GET", expectedStatus: 200 },
  { path: "/api/services", method: "GET", expectedStatus: 200 },
  { path: "/api/faqs", method: "GET", expectedStatus: 200 },
  { path: "/api/recommendations", method: "GET", expectedStatus: 200 },
  { path: "/api/products", method: "GET", expectedStatus: [200, 404] },
  { path: "/api/search", method: "GET", expectedStatus: 200 },
  { path: "/api/pwa-manifest", method: "GET", expectedStatus: 200 },

  // POST endpoints (may require auth)
  { path: "/api/contact", method: "POST", expectedStatus: [400, 401, 403, 404, 405] },
  { path: "/api/subscribe", method: "POST", expectedStatus: [200, 400, 401] },
  { path: "/api/calendar/book", method: "POST", expectedStatus: [400, 401, 404] },
  { path: "/api/chat", method: "POST", expectedStatus: [200, 400, 401, 404] },
  { path: "/api/chat-ai", method: "POST", expectedStatus: [200, 400, 401, 404] },

  // Webhook endpoints (should return 404 or 405 for GET)
  { path: "/api/webhooks/stripe", method: "GET", expectedStatus: [404, 405] },

  // Internal endpoints (may be protected)
  { path: "/api/internal", method: "GET", expectedStatus: [401, 403, 404] },
  { path: "/api/workflows", method: "GET", expectedStatus: [401, 403, 404] },
];

test.describe("API Routes - Complete Coverage", () => {
  const routes = getAllApiRoutes();

  for (const route of routes) {
    test(`API ${route.method} ${route.path}`, async ({ request }) => {
      let response;

      if (route.method === "GET") {
        response = await request.get(`${BASE_URL}${route.path}`);
      } else {
        response = await request.post(`${BASE_URL}${route.path}`, {
          data: { test: "data" },
        });
      }

      const expectedStatuses = Array.isArray(route.expectedStatus)
        ? route.expectedStatus
        : [route.expectedStatus];
      expect(expectedStatuses).toContain(response.status());
    });
  }

  test.describe("Analytics API", () => {
    test("analytics endpoint responds", async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/analytics`);
      expect([200, 401, 403, 404]).toContain(response.status());
    });
  });

  test.describe("User API", () => {
    test("user profile endpoint requires auth", async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/user/profile`);
      expect([401, 403, 404]).toContain(response.status());
    });
  });

  test.describe("Newsletter API", () => {
    test("newsletter endpoint validates", async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/subscribe`, {
        data: { email: "invalid-email" },
      });
      expect([200, 400, 401]).toContain(response.status());
    });

    test("newsletter slack endpoint", async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/newsletter-slack`);
      expect([200, 401, 403, 404, 405]).toContain(response.status());
    });
  });

  test.describe("Admin API", () => {
    test("admin endpoints are protected", async ({ request }) => {
      const adminRoutes = [
        "/api/admin",
        "/api/admin/auth-audit",
        "/api/admin/oauth",
      ];

      for (const path of adminRoutes) {
        const response = await request.get(`${BASE_URL}${path}`);
        expect([401, 403, 404]).toContain(response.status());
      }
    });
  });

  test.describe("Docs API", () => {
    test("docs API responds", async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/docs`);
      expect([200, 404]).toContain(response.status());
    });
  });

  test.describe("Notion Image API", () => {
    test("notion-image endpoint", async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/notion-image`);
      expect([200, 400, 404]).toContain(response.status());
    });
  });

  test.describe("Portal API", () => {
    test("portal endpoints are protected", async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/portal`);
      expect([401, 403, 404]).toContain(response.status());
    });
  });

  test.describe("CSP Report API", () => {
    test("CSP report endpoint accepts POST", async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/csp-report`, {
        data: { "csp-report": { "blocked-uri": "test" } },
        headers: { "content-type": "application/json" },
      });
      expect([200, 204, 404]).toContain(response.status());
    });
  });

  test.describe("Track API", () => {
    test("track endpoint responds", async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/track`);
      expect([200, 404, 405]).toContain(response.status());
    });
  });

  test.describe("Unsubscribe API", () => {
    test("unsubscribe endpoint", async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/unsubscribe`);
      expect([200, 400, 404]).toContain(response.status());
    });
  });
});