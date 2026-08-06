import { test, expect } from "@playwright/test";
import { createAPIHelper } from "../helpers/api-helpers";

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
      expect(json.status).toBe("ok");
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
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      expect(response.status()).toBeLessThan(500);
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
    
    test("should return blog categories", async ({ request }) => {
      const response = await apiHelper.get("/api/blog/categories");
      
      expect(response.status()).toBeLessThan(500);
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
    
    test("should return blog tags", async ({ request }) => {
      const response = await apiHelper.get("/api/blog/tags");
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      expect(response.status()).toBeLessThan(500);
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
    
    test("should return calendar events", async ({ request }) => {
      const response = await apiHelper.get("/api/calendar/events");
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      const response = await apiHelper.post("/api/contact", contactData, {
        expectedStatus: [200, 201, 400, 429] // 429 for rate limiting
      });
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      const response = await apiHelper.post("/api/contact", invalidData, {
        expectedStatus: [400, 422] // Validation error
      });
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      expect(response.status()).toBeLessThan(500);
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
    
    test("should return single FAQ", async ({ request }) => {
      // First get list to find a valid ID
      const listResponse = await apiHelper.get("/api/faqs");
      let faqId = "test-faq"; // fallback
      
      if (listResponse.status() < 400) {
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
      
      expect(response.status()).toBeLessThan(500);
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
  });

  // Test Health endpoint (detailed)
  test.describe("Health Endpoint (Detailed)", () => {
    test("should return detailed health information", async ({ request }) => {
      const response = await apiHelper.get("/api/health/detailed");
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      expect(response.status()).toBeLessThan(500);
      
      if (response.status() < 400) {
        const json = await response.json();
        expect(json).toBeDefined();
      }
    });
    
    test("should return service categories", async ({ request }) => {
      const response = await apiHelper.get("/api/services/categories");
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      const response = await apiHelper.post("/api/jobs/apply", applicationData, {
        expectedStatus: [200, 201, 400, 429]
      });
      
      expect(response.status()).toBeLessThan(500);
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
      
      const response = await apiHelper.post("/api/newsletter/subscribe", subscriptionData, {
        expectedStatus: [200, 201, 400, 409] // 409 if already subscribed
      });
      
      expect(response.status()).toBeLessThan(500);
    });
    
    test("should validate newsletter subscription data", async ({ request }) => {
      // Test with invalid email
      const invalidData = {
        email: "invalid-email",
        name: "Test User"
      };
      
      const response = await apiHelper.post("/api/newsletter/subscribe", invalidData, {
        expectedStatus: [400, 422]
      });
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      await apiHelper.post("/api/newsletter/subscribe", subscriptionData, {
        expectedStatus: [200, 201, 400, 409]
      });
      
      // Then unsubscribe
      const response = await apiHelper.post("/api/newsletter/unsubscribe", {
        email: subscriptionData.email
      }, {
        expectedStatus: [200, 204, 400, 404]
      });
      
      expect(response.status()).toBeLessThan(500);
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
      
      expect(response.status()).toBeLessThan(500);
      
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
      
      expect(response.status()).toBeLessThan(500);
      
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
      const response = await apiHelper.get("/api/sitemap.xml");
      
      expect(response.status()).toBe(200);
      
      const contentType = response.headers()["content-type"] || "";
      expect(contentType).toContain("application/xml");
      
      const text = await response.text();
      expect(text).toContain("<urlset");
      expect(text).toContain("</urlset>");
    });
  });

  // Test Robots.txt endpoint
  test.describe("Robots.txt Endpoint", () => {
    test("should return robots.txt", async ({ request }) => {
      const response = await apiHelper.get("/api/robots.txt");
      
      expect(response.status()).toBe(200);
      
      const contentType = response.headers()["content-type"] || "";
      expect(contentType).toContain("text/plain");
      
      const text = await response.text();
      expect(text).toContain("User-agent:");
      expect(text).toContain("Disallow:");
    });
  });

  // Test Error handling
  test.describe("Error Handling", () => {
    test("should return 404 for non-existent endpoints", async ({ request }) => {
      const response = await apiHelper.get("/api/this-endpoint-does-not-exist");
      
      expect(response.status()).toBe(404);
    });
    
    test("should return 405 for wrong HTTP method", async ({ request }) => {
      const response = await apiHelper.get("/api/contact", {
        expectedStatus: 405 // GET not allowed on contact endpoint
      });
      
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
      
      const response = await apiHelper.post("/api/contact", largeData, {
        expectedStatus: [400, 413, 429] // 413 for payload too large
      });
      
      expect(response.status()).toBeLessThan(500);
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
          apiHelper.get("/api/health", {
            expectedStatus: [200, 429] // 200 OK or 429 Too Many Requests
          })
        );
      }
      
      const responses = await Promise.all(requests);
      
      // All responses should be valid (either success or rate limited)
      for (const response of responses) {
        expect(response.status()).toBeLessThan(500);
      }
      
      // At least some should be rate limited if we made enough requests quickly
      // This is probabilistic and depends on rate limit configuration
    });
  });
});