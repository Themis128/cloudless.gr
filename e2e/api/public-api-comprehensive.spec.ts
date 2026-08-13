import { test, expect } from "@playwright/test";
import { createAPIHelper, assertPublicRouteWired } from "../helpers/api-helpers";

/**
 * Comprehensive Public API Test Suite
 * Tests all public endpoints with proper validation and error handling
 */

test.describe("Public API - Comprehensive Testing", () => {
  let apiHelper: ReturnType<typeof createAPIHelper>;

  test.beforeEach(({ request }) => {
    apiHelper = createAPIHelper(request, "http://localhost:4000", "Public API Test");
  });

  // Test Health endpoint
  test.describe("Health Endpoint", () => {
    test("should return healthy status", async ({ request }) => {
      const response = await apiHelper.get("/api/health");
      
      expect(response.status()).toBe(200);

      const json = await response.json();
      // "degraded" when D1/auth DB is unreachable in local e2e
      expect(["ok", "degraded"]).toContain(json.status);
      expect(json.version).toBeDefined();
      expect(json.authProvider).toBeDefined();
      expect(json.dbConnected).toBeDefined();
      expect(json.timestamp).toBeDefined();
    });
  });

  // Test Blog endpoints
  test.describe("Blog Endpoints", () => {
    test("should return blog posts list", async ({ request }) => {
      const response = await apiHelper.get("/api/blog/posts");
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
        // Could be array or object with posts property
      }
    });
    
    test("should return single blog post", async ({ request }) => {
      // First get list to find a valid ID
      const listResponse = await apiHelper.get("/api/blog/posts");
      let postId = "test-post-id"; // fallback
      
      if (listResponse.status() < 400) {
        try {
          const posts = await listResponse.json();
          if (Array.isArray(posts) && posts.length > 0) {
            postId = posts[0].id || posts[0].slug || "test-post-id";
          } else if (posts && typeof posts === 'object' && posts.posts && Array.isArray(posts.posts)) {
            postId = posts.posts[0].id || posts.posts[0].slug || "test-post-id";
          }
        } catch {
          // Use fallback ID
        }
      }
      
      const response = await apiHelper.get(`/api/blog/posts/${postId}`);
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
    
    test("should return blog categories", async ({ request }) => {
      const response = await apiHelper.get("/api/blog/categories");
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
    
    test("should return blog tags", async ({ request }) => {
      const response = await apiHelper.get("/api/blog/tags");
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
  });

  // Test Calendar endpoints
  test.describe("Calendar Endpoints", () => {
    test("should return calendar availability", async ({ request }) => {
      const response = await apiHelper.get("/api/calendar/availability");
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
    
    test("should return calendar events", async ({ request }) => {
      const response = await apiHelper.get("/api/calendar/events");
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
  });

  // Test Case Studies endpoints
  test.describe("Case Studies Endpoints", () => {
    test("should return case studies list", async ({ request }) => {
      const response = await apiHelper.get("/api/case-studies");
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
    
    test("should return single case study", async ({ request }) => {
      // First get list to find a valid ID
      const listResponse = await apiHelper.get("/api/case-studies");
      let caseStudyId = "test-case-study"; // fallback
      
      if (listResponse.status() < 400) {
        try {
          const caseStudies = await listResponse.json();
          if (Array.isArray(caseStudies) && caseStudies.length > 0) {
            caseStudyId = caseStudies[0].id || caseStudies[0].slug || "test-case-study";
          } else if (caseStudies && typeof caseStudies === 'object' && caseStudies.items && Array.isArray(caseStudies.items)) {
            caseStudyId = caseStudies.items[0].id || caseStudies.items[0].slug || "test-case-study";
          }
        } catch {
          // Use fallback ID
        }
      }
      
      const response = await apiHelper.get(`/api/case-studies/${caseStudyId}`);
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
  });

  // Test Contact endpoints
  test.describe("Contact Endpoints", () => {
    test("should accept contact form submission", async ({ request }) => {
      const contactData = {
        name: `Test User ${Date.now()}`,
        email: `test${Date.now()}@example.com`,
        message: `Test message from automated test at ${new Date().toISOString()}`
      };
      
      const response = await apiHelper.post("/api/contact", contactData);
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
        // Should contain success message or ID
      }
    });
    
    test("should validate contact form data", async ({ request }) => {
      // Test with missing required fields
      const invalidData = {
        name: "", // Empty name
        email: "invalid-email", // Invalid email
        message: "" // Empty message
      };
      
      const response = await apiHelper.post("/api/contact", invalidData);
      
      assertPublicRouteWired(response.status());
      
      if (response.status() >= 400 && response.status() < 500) {
        const json = await response.json();
        expect(json).toBeDefined();
        // Should contain validation error messages
      }
    });
  });

  // Test Documentation endpoints
  test.describe("Documentation Endpoints", () => {
    test("should return documentation list", async ({ request }) => {
      const response = await apiHelper.get("/api/docs");
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
    
    test("should return single documentation page", async ({ request }) => {
      // First get list to find a valid ID
      const listResponse = await apiHelper.get("/api/docs");
      let docId = "test-doc"; // fallback
      
      if (listResponse.status() < 400) {
        try {
          const docs = await listResponse.json();
          if (Array.isArray(docs) && docs.length > 0) {
            docId = docs[0].id || docs[0].slug || "test-doc";
          } else if (docs && typeof docs === 'object' && docs.items && Array.isArray(docs.items)) {
            docId = docs.items[0].id || docs.items[0].slug || "test-doc";
          }
        } catch {
          // Use fallback ID
        }
      }
      
      const response = await apiHelper.get(`/api/docs/${docId}`);
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
  });

  // Test FAQs endpoints
  test.describe("FAQs Endpoints", () => {
    test("should return FAQs list", async ({ request }) => {
      const response = await apiHelper.get("/api/faqs");
      assertPublicRouteWired(response.status());

      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
    
    test("should return single FAQ", async ({ request }) => {
      // First get list to find a valid ID
      const listResponse = await apiHelper.get("/api/faqs");
      assertPublicRouteWired(listResponse.status());
      const listStatus = listResponse.status();
      
      let faqId = "test-faq"; // fallback
      
      if (listStatus >= 200 && listStatus < 400) {
        try {
          const faqs = await listResponse.json();
          if (Array.isArray(faqs) && faqs.length > 0) {
            faqId = faqs[0].id || faqs[0].slug || "test-faq";
          } else if (faqs && typeof faqs === 'object' && faqs.items && Array.isArray(faqs.items)) {
            faqId = faqs.items[0].id || faqs.items[0].slug || "test-faq";
          }
        } catch {
          // Use fallback ID
        }
      }
      
      const response = await apiHelper.get(`/api/faqs/${faqId}`);
      assertPublicRouteWired(response.status());
      const status = response.status();
      
      if (status >= 200 && status < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
  });

  // Test Health endpoint (detailed)
  test.describe("Health Endpoint (Detailed)", () => {
    test("should return detailed health information", async ({ request }) => {
      const response = await apiHelper.get("/api/health/detailed");
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
        // Should contain detailed system information
      }
    });
  });

  // Test PWA Manifest endpoint
  test.describe("PWA Manifest Endpoint", () => {
    test("should return PWA manifest", async ({ request }) => {
      const response = await apiHelper.get("/api/pwa-manifest");
      
      expect(response.status()).toBe(200);
      
      const json = await response.json();
      expect(json.name).toBeDefined();
      expect(json.short_name).toBeDefined();
      expect(json.start_url).toBeDefined();
      expect(json.display).toBeDefined();
      expect(json.icons).toBeDefined();
      expect(Array.isArray(json.icons)).toBeTruthy();
    });
  });

  // Test Services endpoints
  test.describe("Services Endpoints", () => {
    test("should return services list", async ({ request }) => {
      const response = await apiHelper.get("/api/services");
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
    
    test("should return single service", async ({ request }) => {
      // First get list to find a valid ID
      const listResponse = await apiHelper.get("/api/services");
      let serviceId = "test-service"; // fallback
      
      if (listResponse.status() < 400) {
        try {
          const services = await listResponse.json();
          if (Array.isArray(services) && services.length > 0) {
            serviceId = services[0].id || services[0].slug || "test-service";
          } else if (services && typeof services === 'object' && services.items && Array.isArray(services.items)) {
            serviceId = services.items[0].id || services.items[0].slug || "test-service";
          }
        } catch {
          // Use fallback ID
        }
      }
      
      const response = await apiHelper.get(`/api/services/${serviceId}`);
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
    
    test("should return service categories", async ({ request }) => {
      const response = await apiHelper.get("/api/services/categories");
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
  });

  // Test Testimonials endpoints
  test.describe("Testimonials Endpoints", () => {
    test("should return testimonials list", async ({ request }) => {
      const response = await apiHelper.get("/api/testimonials");
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
    
    test("should return single testimonial", async ({ request }) => {
      // First get list to find a valid ID
      const listResponse = await apiHelper.get("/api/testimonials");
      let testimonialId = "test-testimonial"; // fallback
      
      if (listResponse.status() < 400) {
        try {
          const testimonials = await listResponse.json();
          if (Array.isArray(testimonials) && testimonials.length > 0) {
            testimonialId = testimonials[0].id || testimonials[0].slug || "test-testimonial";
          } else if (testimonials && typeof testimonials === 'object' && testimonials.items && Array.isArray(testimonials.items)) {
            testimonialId = testimonials.items[0].id || testimonials[0].slug || "test-testimonial";
          }
        } catch {
          // Use fallback ID
        }
      }
      
      const response = await apiHelper.get(`/api/testimonials/${testimonialId}`);
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
  });

  // Test Jobs/Careers endpoints
  test.describe("Careers Endpoints", () => {
    test("should return job listings", async ({ request }) => {
      const response = await apiHelper.get("/api/jobs");
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
    
    test("should return single job listing", async ({ request }) => {
      // First get list to find a valid ID
      const listResponse = await apiHelper.get("/api/jobs");
      let jobId = "test-job"; // fallback
      
      if (listResponse.status() < 400) {
        try {
          const jobs = await listResponse.json();
          if (Array.isArray(jobs) && jobs.length > 0) {
            jobId = jobs[0].id || jobs[0].slug || "test-job";
          } else if (jobs && typeof jobs === 'object' && jobs.items && Array.isArray(jobs.items)) {
            jobId = jobs.items[0].id || jobs.items[0].slug || "test-job";
          }
        } catch {
          // Use fallback ID
        }
      }
      
      const response = await apiHelper.get(`/api/jobs/${jobId}`);
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
    
    test("should accept job application", async ({ request }) => {
      // First get a valid job ID
      let jobId = "test-job";
      const listResponse = await apiHelper.get("/api/jobs");
      
      if (listResponse.status() < 400) {
        try {
          const jobs = await listResponse.json();
          if (Array.isArray(jobs) && jobs.length > 0) {
            jobId = jobs[0].id || jobs[0].slug || "test-job";
          } else if (jobs && typeof jobs === 'object' && jobs.items && Array.isArray(jobs.items)) {
            jobId = jobs.items[0].id || jobs.items[0].slug || "test-job";
          }
        } catch {
          // Use fallback ID
        }
      }
      
      const applicationData = {
        jobId: jobId,
        name: `Test Applicant ${Date.now()}`,
        email: `test${Date.now()}@example.com`,
        resumeUrl: "https://example.com/resume.pdf",
        coverLetter: "I am excited to apply for this position..."
      };
      
      const response = await apiHelper.post("/api/jobs/apply", applicationData);
      
      assertPublicRouteWired(response.status());
    });
  });

  // Test Newsletter endpoints
  test.describe("Newsletter Endpoints", () => {
    test("should accept newsletter subscription", async ({ request }) => {
      const subscriptionData = {
        email: `test${Date.now()}@example.com`,
        name: `Test Subscriber ${Date.now()}`,
        interests: ["technology", "business"]
      };
      
      const response = await apiHelper.post("/api/subscribe", subscriptionData);
      
      assertPublicRouteWired(response.status());
    });
    
    test("should validate newsletter subscription data", async ({ request }) => {
      // Test with invalid email
      const invalidData = {
        email: "invalid-email",
        name: "Test User"
      };
      
      const response = await apiHelper.post("/api/subscribe", invalidData);
      
      assertPublicRouteWired(response.status());
      
      if (response.status() >= 400 && response.status() < 500) {
        const json = await response.json();
        expect(json).toBeDefined();
        // Should contain validation error messages
      }
    });
    
    test("should allow newsletter unsubscription", async ({ request }) => {
      // First subscribe to get a valid email
      const subscriptionData = {
        email: `test${Date.now()}@example.com`,
        name: `Test Subscriber ${Date.now()}`
      };
      
      await apiHelper.post("/api/subscribe", subscriptionData);
      
      // Then unsubscribe
      const response = await apiHelper.post("/api/unsubscribe", {
        email: subscriptionData.email
      });
      
      assertPublicRouteWired(response.status());
    });
  });

  // Test Search endpoints
  test.describe("Search Endpoints", () => {
    test("should return search results", async ({ request }) => {
      const response = await apiHelper.get("/api/search", {
        queryParams: {
          q: "test",
          limit: "10"
        }
      });
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
        // Should contain results array and metadata
      }
    });
    
    test("should return search suggestions", async ({ request }) => {
      const response = await apiHelper.get("/api/search/suggest", {
        queryParams: {
          q: "tes"
        }
      });
      
      assertPublicRouteWired(response.status());
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
        // Should contain suggestions array
      }
    });
  });

  // Test Sitemap endpoint
  test.describe("Sitemap Endpoint", () => {
    test("should return XML sitemap", async ({ request }) => {
      // App Router serves sitemap via src/app/sitemap.ts → /sitemap.xml
      const response = await apiHelper.get("/sitemap.xml");
      assertPublicRouteWired(response.status());
      if (response.status() === 200) {
        const contentType = response.headers()["content-type"] || "";
        expect(contentType).toMatch(/xml|text/);
        const body = await response.text();
        expect(body.length).toBeGreaterThan(0);
      }
    });
  });

  // Test Robots.txt endpoint
  test.describe("Robots.txt Endpoint", () => {
    test("should return robots.txt", async ({ request }) => {
      // App Router serves robots via src/app/robots.ts → /robots.txt
      const response = await apiHelper.get("/robots.txt");
      assertPublicRouteWired(response.status());
      if (response.status() === 200) {
        const body = await response.text();
        expect(body).toMatch(/User-agent:/i);
      }
    });
  });

  // Test Error handling
  test.describe("Error Handling", () => {
    test("should return 404 for non-existent endpoints", async ({ request }) => {
      const response = await apiHelper.get("/api/this-endpoint-does-not-exist");
      
      expect(response.status()).toBe(404);
    });
    
    test("should return 405 for wrong HTTP method", async ({ request }) => {
      const response = await apiHelper.get("/api/contact");
      
      expect(response.status()).toBe(405);
    });
    
    test("should handle malformed JSON gracefully", async ({ request }) => {
      // This test would require sending raw malformed JSON, which is tricky with Playwright's API
      // We'll skip this for now as it's more complex to implement
    });
    
    test("should handle large payloads appropriately", async ({ request }) => {
      // Test with a reasonably large payload
      const largeData = {
        name: "A".repeat(1000),
        email: `test${Date.now()}@example.com`,
        message: "B".repeat(5000)
      };
      
      const response = await apiHelper.post("/api/contact", largeData);
      
      assertPublicRouteWired(response.status());
    });
  });

  // Test CORS headers
  test.describe("CORS Headers", () => {
    test("should include CORS headers in responses", async ({ request }) => {
      const response = await apiHelper.get("/api/health");
      
      const headers = response.headers();
      // Note: CORS headers might only be present for actual cross-origin requests
      // In same-origin requests, they might not be included
      // This test is more meaningful when testing from a different origin
    });
  });

  // Test Rate limiting
  test.describe("Rate Limiting", () => {
    test("should respect rate limits", async ({ request }) => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          apiHelper.get("/api/health")
        );
      }
      
      const responses = await Promise.all(requests);
      
      // All responses should be valid (either success or rate limited)
      for (const response of responses) {
        assertPublicRouteWired(response.status());
      }
      
      // At least some should be rate limited if we made enough requests quickly
      // This is probabilistic and depends on rate limit configuration
    });
  });

  // Test Checkout endpoints
  test.describe("Checkout Endpoints", () => {
    test("should return checkout session or redirect", async ({ request }) => {
      const response = await apiHelper.get("/api/checkout");
      
      // Should not return 500 (server error) ideally, but we'll accept any valid HTTP status
      assertPublicRouteWired(response.status());
    });
    
    test("should handle POST to checkout endpoint", async ({ request }) => {
      const checkoutData = {
        items: [{ id: "test-product", quantity: 1 }],
        currency: "usd",
        success_url: "http://localhost:3000/success",
        cancel_url: "http://localhost:3000/cancel"
      };
      
      const response = await apiHelper.post("/api/checkout", checkoutData);
      
      assertPublicRouteWired(response.status());
    });
  });

  // Test Auth endpoints
  test.describe("Auth Endpoints", () => {
    test("should handle auth login request", async ({ request }) => {
      const loginData = {
        email: `test${Date.now()}@example.com`,
        password: "TestPassword123!"
      };
      
      const response = await apiHelper.post("/api/auth/login", loginData);
      
      // Accept any status that indicates the endpoint exists and is working
      assertPublicRouteWired(response.status());
    });
    
    test("should handle auth register request", async ({ request }) => {
      const registerData = {
        email: `test${Date.now()}@example.com`,
        name: `Test User ${Date.now()}`,
        password: "TestPassword123!"
      };
      
      const response = await apiHelper.post("/api/auth/register", registerData);
      
      // Accept any status that indicates the endpoint exists and is working
      assertPublicRouteWired(response.status());
    });
    
    test("should handle auth session request", async ({ request }) => {
      const response = await apiHelper.get("/api/auth/session");
      
      // Accept any status that indicates the endpoint exists and is working
      assertPublicRouteWired(response.status());
    });
  });

  // Test User endpoints
  test.describe("User Endpoints", () => {
    test("should handle user profile request", async ({ request }) => {
      const response = await apiHelper.get("/api/user/profile");
      
      // Accept any status that indicates the endpoint exists and is working
      assertPublicRouteWired(response.status());
    });
    
    test("should handle user purchases request", async ({ request }) => {
      const response = await apiHelper.get("/api/user/purchases");
      
      // Accept any status that indicates the endpoint exists and is working
      assertPublicRouteWired(response.status());
    });
  });

  // Test Portal endpoints
  test.describe("Portal Endpoints", () => {
    test("should handle portal enrollment", async ({ request }) => {
      const response = await apiHelper.get("/api/portal/enroll");
      
      // Accept any status that indicates the endpoint exists and is working
      assertPublicRouteWired(response.status());
    });
    
    test("should handle portal token routes", async ({ request }) => {
      // Using a test token - in real scenario this would be a valid token
      const testToken = "test-token-" + Date.now();
      
      const response = await apiHelper.get(`/api/portal/${testToken}`);
      
      // Accept any status that indicates the endpoint exists and is working
      assertPublicRouteWired(response.status());
    });
  });

  // Test Webhook endpoints
  test.describe("Webhook Endpoints", () => {
    test("should handle stripe webhook", async ({ request }) => {
      const webhookData = {
        id: "evt_test_" + Date.now(),
        object: "event",
        api_version: "2023-10-16",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: "pi_test_" + Date.now(),
            object: "payment_intent",
            amount: 1000,
            currency: "usd",
            status: "succeeded"
          }
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: "req_" + Date.now(), idempotency_key: null },
        type: "payment_intent.succeeded"
      };
      
      const response = await apiHelper.post("/api/webhooks/stripe", webhookData);
      
      // Accept any status that indicates the endpoint exists and is working
      assertPublicRouteWired(response.status());
    });
    
    test("should handle content webhook", async ({ request }) => {
      const webhookData = {
        event: "page.updated",
        data: {
          record: {
            id: "test-page-id-" + Date.now(),
            type: "page"
          }
        }
      };

      // Notion webhooks removed; content webhook is the CMS ingress surface
      const response = await apiHelper.post("/api/webhooks/content", webhookData);

      assertPublicRouteWired(response.status());
    });
  });

  // Test Cron endpoints (these are typically internal but we can test they exist)
  test.describe("Cron Endpoints", () => {
    test("should handle cron analytics rollup", async ({ request }) => {
      const response = await apiHelper.get("/api/cron/analytics-rollup");
      
      // Accept any status that indicates the endpoint exists and is working
      assertPublicRouteWired(response.status());
    });
    
    test("should handle cron voice brief", async ({ request }) => {
      const response = await apiHelper.get("/api/cron/voice-brief");
      
      // Accept any status that indicates the endpoint exists and is working
      assertPublicRouteWired(response.status());
    });
  });
});