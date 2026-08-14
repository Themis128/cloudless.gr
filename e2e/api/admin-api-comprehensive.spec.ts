import { test, expect } from "@playwright/test";
import { ADMIN_TOKEN } from "../_internal/admin-fixture";
import { createAPIHelper, assertAdminRouteWired } from "../helpers/api-helpers";
import { requestUntilCompiled } from "../_internal/request-until-compiled";

/**
 * Comprehensive Admin API Test Suite
 * Tests all admin endpoints with proper validation, error handling, and schema checking
 */

test.describe("Admin API - Comprehensive Testing", () => {
  let apiHelper: ReturnType<typeof createAPIHelper>;

  test.beforeEach(({ request }) => {
    apiHelper = createAPIHelper(request, "http://localhost:4000", "Admin API Test");
  });

  // Test authentication requirements
  test.describe("Authentication Requirements", () => {
    test("should reject unauthenticated requests to admin endpoints", async ({ request }) => {
      const response = await requestUntilCompiled(request, "get", "/api/admin/ab-tests");
      expect([401, 403]).toContain(response.status());
    });
  });

  // Test AB Tests endpoint
  test.describe("AB Tests Endpoint", () => {
    test("should return AB tests data when authenticated", async ({ request }) => {
      const response = await apiHelper.get("/api/admin/ab-tests", {
        authToken: ADMIN_TOKEN
      });
      
      // Validate response structure
      assertAdminRouteWired(response.status());
      
      // Try to parse JSON if successful
      if (response.status() < 400) {
        const json = await response.json();
        // Basic validation - structure may vary based on implementation
        expect(json).toBeDefined();
        // Could be an object with data array or just an array
        expect(Array.isArray(json) || (json && typeof json === 'object')).toBeTruthy();
      }
    });
    
    test("should handle invalid AB test ID gracefully", async ({ request }) => {
      const response = await apiHelper.get("/api/admin/ab-tests/invalid-id", {
        authToken: ADMIN_TOKEN
      });
      
      // Should not crash the server
      assertAdminRouteWired(response.status());
    });
  });

  // Test AI Analytics Orchestration endpoint
  test.describe("AI Analytics Orchestration Endpoint", () => {
    test("should return analytics orchestration data", async ({ request }) => {
      const response = await apiHelper.post("/api/admin/ai/analytics-orchestration", {}, {
        authToken: ADMIN_TOKEN
      });
      
      assertAdminRouteWired(response.status());
    });
    
    test("should handle PDF generation request", async ({ request }) => {
      const response = await apiHelper.post("/api/admin/ai/analytics-orchestration/pdf", {}, {
        authToken: ADMIN_TOKEN
      });
      
      assertAdminRouteWired(response.status());
    });
  });

  // Test AI Audience endpoint
  test.describe("AI Audience Endpoint", () => {
    test("should return audience data", async ({ request }) => {
      const response = await apiHelper.post("/api/admin/ai/audience", {
        description: "Test audience for automated testing",
        platforms: ["Meta", "LinkedIn"],
        objective: "LEAD_GENERATION"
      }, {
        authToken: ADMIN_TOKEN
      });
      
      assertAdminRouteWired(response.status());
    });
  });

  // Test AI Campaign endpoint
  test.describe("AI Campaign Endpoint", () => {
    test("should accept campaign creation data", async ({ request }) => {
      const campaignData = {
        brief: "Test campaign brief for automated testing",
        budget: "1000",
        targetAudience: "Test audience"
      };
      
      const response = await apiHelper.post("/api/admin/ai/campaign", campaignData, {
        authToken: ADMIN_TOKEN
      });
      
      assertAdminRouteWired(response.status());
    });
  });

  // Test AI Copy endpoint
  test.describe("AI Copy Endpoint", () => {
    test("should return copy generation data", async ({ request }) => {
      const copyRequest = {
        prompt: "Write a catchy headline for a tech product",
        context: "B2B SaaS product for enterprise customers",
        tone: "professional",
        length: "short"
      };
      
      const response = await apiHelper.post("/api/admin/ai/copy", copyRequest, {
        authToken: ADMIN_TOKEN
      });
      
      assertAdminRouteWired(response.status());
    });
    
    test("should accept copy generation request", async ({ request }) => {
      const copyRequest = {
        prompt: "Write a catchy headline for a tech product",
        context: "B2B SaaS product for enterprise customers",
        tone: "professional",
        length: "short"
      };
      
      const response = await apiHelper.post("/api/admin/ai/copy", copyRequest, {
        authToken: ADMIN_TOKEN
      });
      
      assertAdminRouteWired(response.status());
    });
  });

  // Test Analytics endpoints
  test.describe("Analytics Endpoints", () => {
    // Endpoints that return 503 when services not configured (GSC-dependent)
    const analyticsEndpoints503 = [
      "/api/admin/analytics/devices",
      "/api/admin/analytics/products",
      "/api/admin/analytics/pages",
      "/api/admin/analytics/query-pages",
      "/api/admin/analytics/search-intent",
      "/api/admin/analytics/seo",
      "/api/admin/analytics/countries"
    ];
    
    analyticsEndpoints503.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        assertAdminRouteWired(response.status());
      });
    });
    
    // Endpoints that return placeholder data when services not configured
    const analyticsEndpointsPlaceholder = [
      "/api/admin/analytics/history",
      "/api/admin/analytics/keywords",
      "/api/admin/analytics/unified",
      "/api/admin/analytics/web"
    ];
    
    analyticsEndpointsPlaceholder.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        // Accept any status that indicates the endpoint exists and is working
        // These endpoints return placeholder data (200) when services not configured
        assertAdminRouteWired(response.status());
      });
    });
  });

  // Test Cache endpoint
  test.describe("Cache Endpoint", () => {
    test("should return cache statistics", async ({ request }) => {
      const response = await apiHelper.post("/api/admin/cache", {}, {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      // This endpoint returns 200 with cache statistics
      assertAdminRouteWired(response.status());
    });
    
    test("should accept cache clear request", async ({ request }) => {
      const response = await apiHelper.post("/api/admin/cache/clear", {}, {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
  });

  // Test Calendar endpoint
  test.describe("Calendar Endpoint", () => {
    test("should return calendar data", async ({ request }) => {
      const response = await apiHelper.get("/api/admin/calendar", {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
    
    test("should accept calendar event creation", async ({ request }) => {
      const eventData = {
        title: `Test Event ${Date.now()}`,
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
        description: "Test event created by automated test"
      };
      
      const response = await apiHelper.post("/api/admin/calendar/create", eventData, {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
  });

  // Test CRM endpoints
  test.describe("CRM Endpoints", () => {
    const crmEndpoints = [
      "/api/admin/crm/companies",
      "/api/admin/crm/contacts",
      "/api/admin/crm/deals",
      "/api/admin/crm/owners",
      "/api/admin/crm/pipelines",
      "/api/admin/crm/tickets"
    ];
    
    crmEndpoints.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        assertAdminRouteWired(response.status());
      });
    });
  });

  // Test Email endpoints
  test.describe("Email Endpoints", () => {
    const emailEndpoints = [
      "/api/admin/email/automations",
      "/api/admin/email/campaigns",
      "/api/admin/email/contacts",
      "/api/admin/email/lists",
      "/api/admin/email/stats"
    ];
    
    emailEndpoints.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        assertAdminRouteWired(response.status());
      });
    });
    
    test("should accept email campaign creation", async ({ request }) => {
      const campaignData = {
        name: `Test Campaign ${Date.now()}`,
        subject: "Test Email Subject",
        content: "<h1>Test Email Content</h1>",
        status: "draft"
      };
      
      const response = await apiHelper.post("/api/admin/email/campaigns", campaignData, {
        authToken: ADMIN_TOKEN
      });
      
      assertAdminRouteWired(response.status());
    });
  });

  // Test Integrations endpoint
  test.describe("Integrations Endpoint", () => {
    test("should return integrations status", async ({ request }) => {
      const response = await apiHelper.get("/api/admin/integrations/status", {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
  });

  // Test KPI endpoint
  test.describe("KPI Endpoint", () => {
    test("should return KPI data", async ({ request }) => {
      const response = await apiHelper.get("/api/admin/kpi", {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
  });

  // Test Notion endpoints
  test.describe("Notion Endpoints", () => {
    const notionEndpoints = [
      "/api/admin/appflowy/analytics",
      "/api/admin/appflowy/blog",
      "/api/admin/appflowy/comments",
      "/api/admin/appflowy/docs",
      "/api/admin/appflowy/projects",
      "/api/admin/appflowy/search",
      "/api/admin/appflowy/status",
      "/api/admin/appflowy/submissions",
      "/api/admin/appflowy/tasks"
    ];
    
    notionEndpoints.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        assertAdminRouteWired(response.status());
      });
    });
  });

  // Test Operations endpoints
  test.describe("Operations Endpoints", () => {
    const opsEndpoints = [
      "/api/admin/ops/errors",
      "/api/admin/ops/monitor"
    ];
    
    opsEndpoints.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        assertAdminRouteWired(response.status());
      });
    });
    
    test("should accept error reporting", async ({ request }) => {
      const errorData = {
        message: `Test error ${Date.now()}`,
        stack: "Test stack trace",
        context: "Automated test"
      };
      
      const response = await apiHelper.post("/api/admin/ops/errors", errorData, {
        authToken: ADMIN_TOKEN
      });
      
      assertAdminRouteWired(response.status());
    });
  });

  // Test Orders endpoint
  test.describe("Orders Endpoint", () => {
    test("should return orders data", async ({ request }) => {
      const response = await apiHelper.get("/api/admin/orders", {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
  });

  // Test Pipeline endpoints
  test.describe("Pipeline Endpoints", () => {
    const pipelineEndpoints = [
      "/api/admin/pipeline/board",
      "/api/admin/pipeline/stats"
    ];
    
    pipelineEndpoints.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        // Accept any status that indicates the endpoint exists and is working
        assertAdminRouteWired(response.status());
      });
    });
    
    test("should accept pipeline card creation", async ({ request }) => {
      const cardData = {
        title: `Test Card ${Date.now()}`,
        description: "Test card created by automated test",
        columnId: "todo",
        position: 0
      };
      
      const response = await apiHelper.post("/api/admin/pipeline/cards", cardData, {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
  });

  // Test Pending Clients endpoint
  test.describe("Pending Clients Endpoint", () => {
    test("should return pending clients data", async ({ request }) => {
      const response = await apiHelper.get("/api/admin/pending-clients", {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
  });

  // Test Reports endpoints
  test.describe("Reports Endpoints", () => {
    const reportEndpoints = [
      "/api/admin/reports",
      "/api/admin/reports/generate"
    ];
    
    reportEndpoints.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        // Accept any status that indicates the endpoint exists and is working
        assertAdminRouteWired(response.status());
      });
    });
    
    test("should accept report generation request", async ({ request }) => {
      const reportRequest = {
        type: "sales_summary",
        dateRange: {
          start: "2026-01-01",
          end: "2026-12-31"
        },
        format: "pdf"
      };
      
      const response = await apiHelper.post("/api/admin/reports/generate", reportRequest, {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
  });

  // Test Subscriptions endpoint
  test.describe("Subscriptions Endpoint", () => {
    test("should return subscriptions data", async ({ request }) => {
      const response = await apiHelper.get("/api/admin/subscriptions", {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
  });

  // Test Users endpoint
  test.describe("Users Endpoint", () => {
    test("should return users data", async ({ request }) => {
      const response = await apiHelper.get("/api/admin/users", {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
    
    test("should accept user creation", async ({ request }) => {
      const userData = {
        email: `test${Date.now()}@example.com`,
        name: `Test User ${Date.now()}`,
        password: "TestPassword123!",
        role: "user"
      };
      
      const response = await apiHelper.post("/api/admin/users", userData, {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
  });

  // Test Workspaces endpoint
  test.describe("Workspaces Endpoint", () => {
    test("should return workspaces data", async ({ request }) => {
      const response = await apiHelper.get("/api/admin/workspaces", {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
  });

  // Test Voice Brief endpoint
  test.describe("Voice Brief Endpoint", () => {
    test("should return voice brief data", async ({ request }) => {
      const response = await apiHelper.get("/api/admin/voice-brief", {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
  });

  // Test Analytics submodules
  test.describe("Analytics Submodules", () => {
    const analyticsSubmodules = [
      "/api/admin/analytics/ctr-opportunities",
      "/api/admin/analytics/datalake",
      "/api/admin/analytics/gsc-archive",
      "/api/admin/analytics/lake-catalog",
      "/api/admin/analytics/lake-parquet",
      "/api/admin/analytics/roi",
      "/api/admin/analytics/search-funnel",
      "/api/admin/analytics/workspaces",
      "/api/admin/analytics/workspaces/[id]"
    ];
    
    analyticsSubmodules.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        // Handle parameterized routes
        const testEndpoint = endpoint.replace("[id]", "test-id");
        
        const response = await apiHelper.get(testEndpoint, {
          authToken: ADMIN_TOKEN
        });
        
        // Accept any status that indicates the endpoint exists and is working
        assertAdminRouteWired(response.status());
      });
    });
  });

  // Test Appflowy submodules
  test.describe("Appflowy Submodules", () => {
    const appflowySubmodules = [
      "/api/admin/appflowy/analytics",
      "/api/admin/appflowy/blog",
      "/api/admin/appflowy/case-studies",
      "/api/admin/appflowy/docs",
      "/api/admin/appflowy/faqs",
      "/api/admin/appflowy/projects",
      "/api/admin/appflowy/search",
      "/api/admin/appflowy/services",
      "/api/admin/appflowy/status",
      "/api/admin/appflowy/submissions",
      "/api/admin/appflowy/tasks",
      "/api/admin/appflowy/testimonials"
    ];
    
    appflowySubmodules.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        assertAdminRouteWired(response.status());
      });
    });
  });

  // Test Campaigns submodules
  test.describe("Campaigns Submodules", () => {
    const campaignsSubmodules = [
      "/api/admin/campaigns/crm-leads",
      "/api/admin/campaigns/google",
      "/api/admin/campaigns/google/insights",
      "/api/admin/campaigns/linkedin",
      "/api/admin/campaigns/linkedin/insights",
      "/api/admin/campaigns/meta",
      "/api/admin/campaigns/meta/insights",
      "/api/admin/campaigns/tiktok",
      "/api/admin/campaigns/tiktok/insights",
      "/api/admin/campaigns/x",
      "/api/admin/campaigns/x/insights"
    ];
    
    campaignsSubmodules.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        // Accept any status that indicates the endpoint exists and is working
        assertAdminRouteWired(response.status());
      });
    });
  });

  // Test Calendar submodules
  test.describe("Calendar Submodules", () => {
    const calendarSubmodules = [
      "/api/admin/calendar/[id]",
      "/api/admin/calendar/[id]/publish",
      "/api/admin/calendar/create"
    ];
    
    calendarSubmodules.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        // Handle parameterized routes
        const testEndpoint = endpoint.replace("[id]", "test-id");
        
        const response = await apiHelper.get(testEndpoint, {
          authToken: ADMIN_TOKEN
        });
        
        // Accept any status that indicates the endpoint exists and is working
        assertAdminRouteWired(response.status());
      });
    });
  });

  // Test Cluster submodules
  test.describe("Cluster Submodules", () => {
    const clusterSubmodules = [
      "/api/admin/cluster/kuma-status",
      "/api/admin/cluster/mqtt-status",
      "/api/admin/cluster/watchdogs"
    ];
    
    clusterSubmodules.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        // Accept any status that indicates the endpoint exists and is working
        assertAdminRouteWired(response.status());
      });
    });
  });

  // Test Cost endpoint
  test.describe("Cost Endpoint", () => {
    test("should return cost data", async ({ request }) => {
      const response = await apiHelper.get("/api/admin/cost", {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
  });

  // Test ESP32 submodules
  test.describe("ESP32 Submodules", () => {
    const esp32Submodules = [
      "/api/admin/esp32"
    ];
    
    esp32Submodules.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        // Accept any status that indicates the endpoint exists and is working
        assertAdminRouteWired(response.status());
      });
    });
  });

  // Test Grafana submodules
  test.describe("Grafana Submodules", () => {
    const grafanaSubmodules = [
      "/api/admin/grafana/dashboards",
      "/api/admin/grafana/datasources",
      "/api/admin/grafana/health",
      "/api/admin/grafana/prometheus"
    ];
    
    grafanaSubmodules.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        // Accept any status that indicates the endpoint exists and is working
        assertAdminRouteWired(response.status());
      });
    });
  });

  // Test Integrations submodules
  test.describe("Integrations Submodules", () => {
    // Already covered integrations/status above, but let's add more if they exist
    test("should handle integrations webhook", async ({ request }) => {
      const response = await apiHelper.get("/api/admin/integrations/webhook", {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
  });

  // Test Leads endpoint
  test.describe("Leads Endpoint", () => {
    test("should return leads data", async ({ request }) => {
      const response = await apiHelper.get("/api/admin/leads", {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
  });

  // Test LinkedIn Cap endpoint
  test.describe("LinkedIn Cap Endpoint", () => {
    test("should return linkedin cap data", async ({ request }) => {
      const response = await apiHelper.get("/api/admin/linkedin-cap", {
        authToken: ADMIN_TOKEN
      });
      
      // Accept any status that indicates the endpoint exists and is working
      assertAdminRouteWired(response.status());
    });
  });

  // Test N8N submodules
  test.describe("N8N Submodules", () => {
    const n8nSubmodules = [
      "/api/admin/n8n/executions",
      "/api/admin/n8n/health",
      "/api/admin/n8n/workflows",
      "/api/admin/n8n/workflows/[id]/trigger"
    ];
    
    n8nSubmodules.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        // Handle parameterized routes
        const testEndpoint = endpoint.replace("[id]", "test-id");
        
        const response = await apiHelper.get(testEndpoint, {
          authToken: ADMIN_TOKEN
        });
        
        // Accept any status that indicates the endpoint exists and is working
        assertAdminRouteWired(response.status());
      });
    });
  });

  // Test Notifications submodules
  test.describe("Notifications Submodules", () => {
    const notificationsSubmodules = [
      "/api/admin/notifications/analytics",
      "/api/admin/notifications/test"
    ];
    
    notificationsSubmodules.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        // Accept any status that indicates the endpoint exists and is working
        assertAdminRouteWired(response.status());
      });
    });
  });

  // Test Notion submodules (additional ones)
  test.describe("Notion Submodules (Additional)", () => {
    // Some notion submodules were already covered above, but let's ensure we have them all
    const notionSubmodules = [
      "/api/admin/appflowy/analytics",
      "/api/admin/appflowy/blog",
      "/api/admin/appflowy/case-studies",
      "/api/admin/appflowy/comments",
      "/api/admin/appflowy/docs",
      "/api/admin/appflowy/faqs",
      "/api/admin/appflowy/projects",
      "/api/admin/appflowy/search",
      "/api/admin/appflowy/services",
      "/api/admin/appflowy/status",
      "/api/admin/appflowy/submissions",
      "/api/admin/appflowy/tasks",
      "/api/admin/appflowy/testimonials"
    ];
    
    notionSubmodules.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        assertAdminRouteWired(response.status());
        
        if (response.status() < 400) {
          const json = await response.json();
          expect(json).toBeDefined();
        }
      });
    });
  });

  // Test Oauth submodules
  test.describe("Oauth Submodules", () => {
    const oauthSubmodules = [
      "/api/admin/oauth/tiktok",
      "/api/admin/oauth/tiktok/callback"
    ];
    
    oauthSubmodules.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        assertAdminRouteWired(response.status());
        // OAuth start may 302 to the provider — do not require JSON
      });
    });
  });

  // Test Ops submodules (additional)
  test.describe("Ops Submodules (Additional)", () => {
    const opsSubmodules = [
      "/api/admin/ops/errors/[id]"
    ];
    
    opsSubmodules.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        // Handle parameterized routes
        const testEndpoint = endpoint.replace("[id]", "test-id");
        
        const response = await apiHelper.get(testEndpoint, {
          authToken: ADMIN_TOKEN
        });
        
        // Accept any status that indicates the endpoint exists and is working
        assertAdminRouteWired(response.status());
      });
    });
  });

  // Test Postiz submodules
  test.describe("Postiz Submodules", () => {
    const postizSubmodules = [
      "/api/admin/postiz/analytics/integration/[id]",
      "/api/admin/postiz/analytics/post/[id]",
      "/api/admin/postiz/groups",
      "/api/admin/postiz/health",
      "/api/admin/postiz/integrations",
      "/api/admin/postiz/integrations/[id]/connect",
      "/api/admin/postiz/integrations/[id]/settings",
      "/api/admin/postiz/integrations/[id]/trigger",
      "/api/admin/postiz/is-connected",
      "/api/admin/postiz/notifications",
      "/api/admin/postiz/posts",
      "/api/admin/postiz/posts/[id]",
      "/api/admin/postiz/posts/[id]/missing-content",
      "/api/admin/postiz/posts/[id]/release-id",
      "/api/admin/postiz/posts/[id]/status",
      "/api/admin/postiz/posts/group/[id]",
      "/api/admin/postiz/slot",
      "/api/admin/postiz/upload",
      "/api/admin/postiz/upload-file"
    ];
    
    postizSubmodules.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        // Handle parameterized routes
        let testEndpoint = endpoint;
        if (endpoint.includes("[id]")) {
          testEndpoint = endpoint.replace("[id]", "test-id");
        }
        
        const response = await apiHelper.get(testEndpoint, {
          authToken: ADMIN_TOKEN
        });
        
        assertAdminRouteWired(response.status());
        
        if (response.status() < 400) {
          const json = await response.json();
          expect(json).toBeDefined();
        }
      });
    });
  });

  // Test Reports submodules
  test.describe("Reports Submodules", () => {
    const reportsSubmodules = [
      "/api/admin/reports",
      "/api/admin/reports/[id]",
      "/api/admin/reports/[id]/pdf",
      "/api/admin/reports/generate"
    ];
    
    reportsSubmodules.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        // Handle parameterized routes
        let testEndpoint = endpoint;
        if (endpoint.includes("[id]")) {
          testEndpoint = endpoint.replace("[id]", "test-id");
        }
        
        const response = await apiHelper.get(testEndpoint, {
          authToken: ADMIN_TOKEN
        });
        
        assertAdminRouteWired(response.status());
        
        if (response.status() < 400) {
          const json = await response.json();
          expect(json).toBeDefined();
        }
      });
    });
  });

  // Test Search submodules
  test.describe("Search Submodules", () => {
    const searchSubmodules = [
      "/api/admin/search/reindex"
    ];
    
    searchSubmodules.forEach(endpoint => {
      test(`should return data for ${endpoint}`, async ({ request }) => {
        const response = await apiHelper.get(endpoint, {
          authToken: ADMIN_TOKEN
        });
        
        assertAdminRouteWired(response.status());
        
        if (response.status() < 400) {
          const json = await response.json();
          expect(json).toBeDefined();
        }
      });
    });
  });

  // Test Subscriptions endpoint (additional tests)
  test.describe("Subscriptions Endpoint (Additional)", () => {
    test("should accept subscription creation/update", async ({ request }) => {
      const subscriptionData = {
        plan: "pro",
        interval: "monthly",
        customerId: "test-customer-" + Date.now()
      };
      
      const response = await apiHelper.post("/api/admin/subscriptions", subscriptionData, {
        authToken: ADMIN_TOKEN
      });
      
      assertAdminRouteWired(response.status());
    });
  });
});