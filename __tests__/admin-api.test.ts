import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { resetIntegrationCache } from "@/lib/integrations";

// Mock api-auth module to provide consistent test tokens
vi.mock("@/lib/api-auth", () => ({
  requireAuth: async (request: NextRequest) => {
    const token = request.headers.get("authorization");
    if (token === "Bearer test-admin-session") {
      return { ok: true, user: { sub: "admin", groups: ["admin"], email_verified: true } };
    }
    if (token === "Bearer test-user-session") {
      return { ok: true, user: { sub: "user", groups: [], email_verified: true } };
    }
    return { ok: false, response: new Response(null, { status: 401 }) };
  },
  requireAdmin: async (request: NextRequest) => {
    const token = request.headers.get("authorization");
    if (token === "Bearer test-admin-session") {
      return { ok: true, user: { sub: "admin", groups: ["admin"], email_verified: true } };
    }
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    };
  },
  requireVerifiedAuth: async (request: NextRequest) => {
    const token = request.headers.get("authorization");
    if (token === "Bearer test-admin-session" || token === "Bearer test-user-session") {
      return { ok: true, user: { sub: "user", email_verified: true } };
    }
    return { ok: false, response: new Response(null, { status: 401 }) };
  },
}));

// ---------------------------------------------------------------------------
// Hoist mock variables so vi.mock() factories can reference them safely.
// ---------------------------------------------------------------------------

const { mockGetConfig, mockIsConfiguredAsync, mockResetIntegrationCache, mockGetSlackConfigAsync } =
  vi.hoisted(() => ({
    mockGetConfig: vi.fn(),
    mockIsConfiguredAsync: vi.fn().mockResolvedValue(true),
    mockResetIntegrationCache: vi.fn(),
    mockGetSlackConfigAsync: vi.fn().mockResolvedValue({
      SLACK_BOT_TOKEN: "xoxb-test",
      SLACK_WEBHOOK_URL: "",
      SLACK_SIGNING_SECRET: "signing-secret-test",
    }),
  }));

// ---------------------------------------------------------------------------
// Mock ssm-config so tests never touch AWS SSM and getConfig() is controllable.
// ---------------------------------------------------------------------------

vi.mock("@/lib/ssm-config", () => ({
  getConfig: mockGetConfig,
  resetSsmCache: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock integrations so isConfiguredAsync() is controllable per-test.
// ---------------------------------------------------------------------------

vi.mock("@/lib/integrations", () => ({
  isConfiguredAsync: mockIsConfiguredAsync,
  isConfigured: vi.fn().mockReturnValue(true),
  resetIntegrationCache: mockResetIntegrationCache,
  getIntegrations: vi.fn().mockReturnValue({}),
  getIntegrationsAsync: vi.fn().mockResolvedValue({}),
  getSlackConfigAsync: mockGetSlackConfigAsync,
}));

const GSC_CONFIGURED_CONFIG = {
  SES_FROM_EMAIL: "test@cloudless.gr",
  SES_TO_EMAIL: "inbox@cloudless.gr",
  STRIPE_SECRET_KEY: "sk_test_123",
  STRIPE_PUBLISHABLE_KEY: "",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  SLACK_WEBHOOK_URL: "",
  SLACK_BOT_TOKEN: "",
  SLACK_SIGNING_SECRET: "",
  HUBSPOT_API_KEY: "test-hs-token",
  NOTION_API_KEY: "secret_test_key_12345",
  NOTION_BLOG_DB_ID: "",
  NOTION_WEBHOOK_SECRET: "",
  NOTION_SUBMISSIONS_DB_ID: "",
  NOTION_DOCS_DB_ID: "",
  NOTION_PROJECTS_DB_ID: "",
  NOTION_TASKS_DB_ID: "",
  NOTION_ANALYTICS_DB_ID: "",
  GOOGLE_CLIENT_EMAIL: "svc@project.iam.gserviceaccount.com",
  GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----",
  GOOGLE_CALENDAR_ID: "calendar@cloudless.gr",
  GSC_SITE_URL: "sc-domain:cloudless.gr",
  SENTRY_AUTH_TOKEN: "",
  SENTRY_ORG: "baltzakisthemiscom",
  SENTRY_PROJECT: "cloudless-gr",
  ACTIVECAMPAIGN_API_URL: "https://test.api-us1.com",
  ACTIVECAMPAIGN_API_TOKEN: "test-ac-token",
  GOOGLE_ADS_DEVELOPER_TOKEN: "",
  GOOGLE_ADS_CUSTOMER_ID: "",
  LINKEDIN_CLIENT_ID: "",
  LINKEDIN_CLIENT_SECRET: "",
  LINKEDIN_ACCESS_TOKEN: "",
  LINKEDIN_AD_ACCOUNT_ID: "",
  LINKEDIN_ORGANIZATION_URN: "",
  TIKTOK_APP_ID: "",
  TIKTOK_APP_SECRET: "",
  TIKTOK_ACCESS_TOKEN: "",
  TIKTOK_ADVERTISER_ID: "",
  X_API_KEY: "",
  X_API_SECRET: "",
  X_ACCESS_TOKEN: "",
  X_ACCESS_SECRET: "",
  X_AD_ACCOUNT_ID: "",
  META_AD_ACCOUNT_ID: "",
  META_PIXEL_ID: "",
  META_CAPI_ACCESS_TOKEN: "",
  META_ACCESS_TOKEN: "",
  META_PAGE_ID: "",
  ANTHROPIC_API_KEY: "test-anthropic-key",
};

// Set default getConfig() return value (overridden per-test where needed).
mockGetConfig.mockResolvedValue(GSC_CONFIGURED_CONFIG);
// Reset mocks before each test to the safe defaults.
beforeEach(() => {
  mockGetConfig.mockResolvedValue(GSC_CONFIGURED_CONFIG);
  mockIsConfiguredAsync.mockResolvedValue(true);
  mockGetSlackConfigAsync.mockResolvedValue({
    SLACK_BOT_TOKEN: "xoxb-test",
    SLACK_WEBHOOK_URL: "",
    SLACK_SIGNING_SECRET: "signing-secret-test",
  });
});

// ---------------------------------------------------------------------------
// Mock jose: replace jwtVerify with a decode-only version so tests can use
// fake-signed tokens without hitting the real JWKS endpoint.
// createRemoteJWKSet is kept but its result is never used (jwtVerify is mocked).
// ---------------------------------------------------------------------------
vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT structure");
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      if (payload.exp && Date.now() >= payload.exp * 1000) throw new Error("JWT expired");
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock admin token with D1-style claims. No real signature —
 *  verifyToken falls back to decode-only when D1_ISSUER is unset. */
function makeAdminToken(): string {
  return "test-admin-session";
}

/** Build a mock non-admin token with D1-style claims. */
function makeUserToken(): string {
  return "test-user-session";
}

// Helper functions to create authenticated requests
function adminRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, {
    method: init?.method,
    body: init?.body,
    headers: { Authorization: "Bearer test-admin-session" },
  });
}

function userRequest(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { Authorization: "Bearer test-user-session" },
  });
}

function unauthRequest(url: string): NextRequest {
  return new NextRequest(url);
}

// ---------------------------------------------------------------------------
// Mocks — set up before any dynamic import
// ---------------------------------------------------------------------------

// Stripe
const mockStripeCheckout = vi.fn();
const mockStripeSubs = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn().mockResolvedValue({
    checkout: {
      sessions: { list: mockStripeCheckout },
    },
    subscriptions: { list: mockStripeSubs },
  }),
}));

// Google Search Console (legacy — analytics routes use datalake-serve)
vi.mock("@/lib/gsc", () => ({
  getSeoSnapshot: vi.fn(),
  getTopKeywords: vi.fn(),
  getTopPages: vi.fn(),
  getPerformanceHistory: vi.fn(),
  getWebAnalytics: vi.fn(),
  getCtrOpportunities: vi.fn(),
  getDeviceBreakdown: vi.fn(),
  getProductPageMetrics: vi.fn(),
  getQueryPageMapping: vi.fn(),
  getSearchIntentBreakdown: vi.fn(),
  getTrafficByCountry: vi.fn(),
}));

const { lakeMocks } = vi.hoisted(() => ({
  lakeMocks: {
    getSeoFromLake: vi.fn(),
    getGscDimensionFromLake: vi.fn(),
    getCtrOpportunitiesFromLake: vi.fn(),
  },
}));

vi.mock("@/lib/datalake-serve", () => ({
  getSeoFromLake: lakeMocks.getSeoFromLake,
  getGscDimensionFromLake: lakeMocks.getGscDimensionFromLake,
  getCtrOpportunitiesFromLake: lakeMocks.getCtrOpportunitiesFromLake,
}));

const SAMPLE_SEO = {
  snapshot: {
    clicks: 500,
    impressions: 12000,
    ctr: 0.0417,
    position: 14.2,
    days: 28,
  },
  keywords: [
    { query: "cloudless gr", clicks: 120, impressions: 3000, ctr: 0.04, position: 8.5 },
  ],
  fetchedAt: "2026-08-13T12:00:00.000Z",
  source: "datalake-gold" as const,
};

const SAMPLE_DIMENSION = {
  dimension: "device",
  rows: [] as unknown[],
  snapshot: SAMPLE_SEO.snapshot,
  fetchedAt: SAMPLE_SEO.fetchedAt,
  source: "datalake-gold" as const,
  note: "Dimension stub from gold",
};

// EspoCRM
vi.mock("@/lib/espocrm", () => ({
  listContacts: vi
    .fn()
    .mockResolvedValue([{ id: "1", email: "lead@example.com", firstName: "Test" }]),
}));

// Slack notify
vi.mock("@/lib/slack-notify", () => ({
  slackErrorNotify: vi.fn().mockResolvedValue(undefined),
  SlackClient: vi.fn().mockImplementation(() => ({
    post: vi.fn().mockResolvedValue(true),
  })),
}));

// Sentry
vi.mock("@/lib/sentry", () => ({
  isSentryConfigured: vi.fn().mockReturnValue(true),
  getUnresolvedIssues: vi.fn().mockResolvedValue({
    issues: [],
    total: 0,
    fetchedAt: new Date().toISOString(),
  }),
  verifySentryToken: vi.fn().mockResolvedValue({ status: "error" }),
}));

// ---------------------------------------------------------------------------
// /api/admin/users
// ---------------------------------------------------------------------------

describe("GET /api/admin/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeCheckout.mockResolvedValue({
      data: [
        {
          id: "cs_test_1",
          customer_details: { email: "buyer@example.com" },
          customer_email: null,
          amount_total: 4900,
          currency: "eur",
          payment_status: "paid",
          mode: "payment",
          line_items: {
            data: [{ description: "Pro Plan", quantity: 1, amount_total: 4900 }],
          },
          created: 1700000000,
        },
      ],
    });
    mockStripeSubs.mockResolvedValue({ data: [] });
  });

  it("rejects unauthenticated requests", async () => {
    const { GET } = await import("@/app/api/admin/orders/route");
    const res = await GET(unauthRequest("http://localhost/api/admin/orders"));
    expect([401, 403]).toContain(res.status);
  });

  it("returns 403 for non-admin user", async () => {
    const { GET } = await import("@/app/api/admin/orders/route");
    const res = await GET(userRequest("http://localhost/api/admin/orders"));
    expect(res.status).toBe(403);
  });

  it("returns orders + subscriptions for admin", async () => {
    const { GET } = await import("@/app/api/admin/orders/route");
    const res = await GET(adminRequest("http://localhost/api/admin/orders"));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data.orders)).toBe(true);
    expect(Array.isArray(data.subscriptions)).toBe(true);
    expect(typeof data.fetchedAt).toBe("string");

    const order = data.orders[0];
    expect(order).toMatchObject({
      id: "cs_test_1",
      email: "buyer@example.com",
      amount: 49,
      currency: "EUR",
      status: "paid",
    });
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/web  (datalake gold)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/web", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getSeoFromLake.mockResolvedValue(SAMPLE_SEO);
  });

  it("returns analytics payload from lake SEO snapshot", async () => {
    const { GET } = await import("@/app/api/admin/analytics/web/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/web"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("analytics");
    expect(typeof data.fetchedAt).toBe("string");
    expect(data.source).toBe("datalake-gold");
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/seo  (datalake gold)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/seo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getSeoFromLake.mockResolvedValue(SAMPLE_SEO);
  });

  it("returns snapshot + keywords from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/seo/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/seo"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("snapshot");
    expect(Array.isArray(data.keywords)).toBe(true);
    expect(typeof data.fetchedAt).toBe("string");
    expect(data.source).toBe("datalake-gold");
  });
});

// ---------------------------------------------------------------------------
// /api/admin/crm/contacts
// ---------------------------------------------------------------------------

describe("GET /api/admin/crm/contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // prevents stale integrations module instance leaking from prior describe
    resetIntegrationCache();
  });

  it("rejects unauthenticated requests", async () => {
    const { GET } = await import("@/app/api/admin/crm/contacts/route");
    const res = await GET(unauthRequest("http://localhost/api/admin/crm/contacts"));
    expect([401, 403]).toContain(res.status);
  });

  it("returns 503 when EspoCRM is not configured", async () => {
    mockIsConfiguredAsync.mockResolvedValueOnce(false);
    const { GET } = await import("@/app/api/admin/crm/contacts/route");
    const res = await GET(adminRequest("http://localhost/api/admin/crm/contacts"));
    expect(res.status).toBe(503);
  });

  it("returns contact list for admin", async () => {
    const { GET } = await import("@/app/api/admin/crm/contacts/route");
    const res = await GET(adminRequest("http://localhost/api/admin/crm/contacts"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.contacts)).toBe(true);
    expect(typeof data.total).toBe("number");
    expect(typeof data.fetchedAt).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// /api/admin/notifications/test
// ---------------------------------------------------------------------------

describe("POST /api/admin/notifications/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // prevents stale integrations module instance leaking from prior describe
    resetIntegrationCache();
    // Stub fetch so SlackClient.post() doesn't make real HTTP calls
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    );
    // Default: Slack is configured (overridden per-test where needed)
    mockGetSlackConfigAsync.mockResolvedValue({
      SLACK_BOT_TOKEN: "xoxb-test",
      SLACK_WEBHOOK_URL: "",
      SLACK_SIGNING_SECRET: "signing-secret-test",
    });
  });

  it("returns 503 when Slack is not configured", async () => {
    mockGetSlackConfigAsync.mockResolvedValue({
      SLACK_BOT_TOKEN: "",
      SLACK_WEBHOOK_URL: "",
      SLACK_SIGNING_SECRET: "",
    });
    const { POST } = await import("@/app/api/admin/notifications/test/route");
    const res = await POST(adminRequest("http://localhost/api/admin/notifications/test"));
    expect(res.status).toBe(503);
  });

  it("returns success when Slack is configured", async () => {
    const { POST } = await import("@/app/api/admin/notifications/test/route");
    const res = await POST(adminRequest("http://localhost/api/admin/notifications/test"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// /api/admin/ops/errors
// ---------------------------------------------------------------------------

// Top-level await is valid in ESM modules — must be outside describe() callbacks.
const { isSentryConfigured, getUnresolvedIssues } =
  await vi.importMock<typeof import("@/lib/sentry")>("@/lib/sentry");

describe("GET /api/admin/ops/errors", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 503 when Sentry is not configured", async () => {
    (isSentryConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const { GET } = await import("@/app/api/admin/ops/errors/route");
    const res = await GET(adminRequest("http://localhost/api/admin/ops/errors"));
    expect(res.status).toBe(503);
  });

  it("returns 502 when Sentry fetch fails", async () => {
    (isSentryConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getUnresolvedIssues as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/ops/errors/route");
    const res = await GET(adminRequest("http://localhost/api/admin/ops/errors"));
    expect(res.status).toBe(502);
  });

  it("returns issues payload when Sentry is configured", async () => {
    (isSentryConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getUnresolvedIssues as ReturnType<typeof vi.fn>).mockResolvedValue({
      issues: [],
      total: 0,
      fetchedAt: new Date().toISOString(),
    });
    const { GET } = await import("@/app/api/admin/ops/errors/route");
    const res = await GET(adminRequest("http://localhost/api/admin/ops/errors"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.issues)).toBe(true);
    expect(typeof data.total).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/keywords  (datalake gold)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/keywords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getSeoFromLake.mockResolvedValue(SAMPLE_SEO);
  });

  it("returns keywords array from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/keywords"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.keywords)).toBe(true);
    expect(typeof data.fetchedAt).toBe("string");
    expect(data.source).toBe("datalake-gold");
  });

  it("respects ?limit query param", async () => {
    lakeMocks.getSeoFromLake.mockResolvedValue({
      ...SAMPLE_SEO,
      keywords: Array.from({ length: 10 }, (_, i) => ({
        query: `q${i}`,
        clicks: i,
        impressions: i * 10,
        ctr: 0.01,
        position: 5,
      })),
    });
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/keywords?limit=5"));
    const data = await res.json();
    expect(lakeMocks.getSeoFromLake).toHaveBeenCalledWith(28);
    expect(data.keywords).toHaveLength(5);
    expect(data._filters).toEqual({ days: 28, limit: 5 });
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/pages  (datalake gold)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getGscDimensionFromLake.mockResolvedValue({
      ...SAMPLE_DIMENSION,
      dimension: "page",
      rows: [{ page: "https://cloudless.gr/", clicks: 200, impressions: 5000 }],
    });
  });

  it("returns pages array from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/pages/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/pages"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.pages)).toBe(true);
    expect(data.source).toBe("datalake-gold");
  });

  it("passes days filter to lake helper", async () => {
    const { GET } = await import("@/app/api/admin/analytics/pages/route");
    await GET(adminRequest("http://localhost/api/admin/analytics/pages?days=10"));
    expect(lakeMocks.getGscDimensionFromLake).toHaveBeenCalledWith("page", 10);
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/history  (datalake gold)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getSeoFromLake.mockResolvedValue(SAMPLE_SEO);
  });

  it("returns empty history with SEO snapshot from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/history/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/history"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.history)).toBe(true);
    expect(data.history).toEqual([]);
    expect(data.snapshot).toEqual(SAMPLE_SEO.snapshot);
    expect(data.source).toBe("datalake-gold");
  });

  it("passes days filter to lake helper", async () => {
    const { GET } = await import("@/app/api/admin/analytics/history/route");
    await GET(adminRequest("http://localhost/api/admin/analytics/history?days=4"));
    expect(lakeMocks.getSeoFromLake).toHaveBeenCalledWith(4);
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/ctr-opportunities  (datalake gold)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/ctr-opportunities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getCtrOpportunitiesFromLake.mockResolvedValue({
      opportunities: [
        { query: "serverless nextjs", clicks: 10, impressions: 800, ctr: 0.0125, position: 7.2 },
      ],
      fetchedAt: SAMPLE_SEO.fetchedAt,
      source: "datalake-gold" as const,
    });
  });

  it("returns opportunities array from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/ctr-opportunities/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/ctr-opportunities"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.opportunities)).toBe(true);
    expect(typeof data.fetchedAt).toBe("string");
    expect(data.source).toBe("datalake-gold");
  });

  it("respects ?limit query param", async () => {
    const { GET } = await import("@/app/api/admin/analytics/ctr-opportunities/route");
    await GET(adminRequest("http://localhost/api/admin/analytics/ctr-opportunities?limit=20"));
    expect(lakeMocks.getCtrOpportunitiesFromLake).toHaveBeenCalledWith(20);
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/devices  (datalake gold)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/devices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getGscDimensionFromLake.mockResolvedValue({
      ...SAMPLE_DIMENSION,
      dimension: "device",
      rows: [
        { device: "DESKTOP", clicks: 300 },
        { device: "MOBILE", clicks: 200 },
      ],
    });
  });

  it("returns devices array from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/devices/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/devices"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.devices)).toBe(true);
    expect(data.source).toBe("datalake-gold");
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/products  (datalake gold)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getGscDimensionFromLake.mockResolvedValue({
      ...SAMPLE_DIMENSION,
      dimension: "product",
      rows: [{ page: "https://cloudless.gr/store/pro-plan", clicks: 40 }],
    });
  });

  it("returns products array from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/products/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/products"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.products)).toBe(true);
    expect(data.source).toBe("datalake-gold");
  });

  it("passes days filter to lake helper", async () => {
    const { GET } = await import("@/app/api/admin/analytics/products/route");
    await GET(adminRequest("http://localhost/api/admin/analytics/products?days=14"));
    expect(lakeMocks.getGscDimensionFromLake).toHaveBeenCalledWith("product", 14);
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/query-pages  (datalake gold)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/query-pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getGscDimensionFromLake.mockResolvedValue({
      ...SAMPLE_DIMENSION,
      dimension: "query_page",
      rows: [{ query: "cloudless hosting", page: "https://cloudless.gr/", clicks: 60 }],
    });
  });

  it("returns queryPages array from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/query-pages/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/query-pages"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.queryPages)).toBe(true);
    expect(data.source).toBe("datalake-gold");
  });

  it("passes days filter to lake helper", async () => {
    const { GET } = await import("@/app/api/admin/analytics/query-pages/route");
    await GET(adminRequest("http://localhost/api/admin/analytics/query-pages?days=50"));
    expect(lakeMocks.getGscDimensionFromLake).toHaveBeenCalledWith("query_page", 50);
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/search-intent  (datalake gold)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/search-intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getSeoFromLake.mockResolvedValue(SAMPLE_SEO);
  });

  it("returns empty intents with keywords from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/search-intent/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/search-intent"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intents).toEqual([]);
    expect(data.keywords).toEqual(SAMPLE_SEO.keywords);
    expect(data).toHaveProperty("snapshot");
    expect(data.source).toBe("datalake-gold");
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/countries  (datalake gold)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/countries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lakeMocks.getGscDimensionFromLake.mockResolvedValue({
      ...SAMPLE_DIMENSION,
      dimension: "country",
      rows: [{ country: "grc", clicks: 350, impressions: 7000 }],
    });
  });

  it("returns countries array from lake", async () => {
    const { GET } = await import("@/app/api/admin/analytics/countries/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/countries"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.countries)).toBe(true);
    expect(data.source).toBe("datalake-gold");
  });

  it("passes days filter to lake helper", async () => {
    const { GET } = await import("@/app/api/admin/analytics/countries/route");
    await GET(adminRequest("http://localhost/api/admin/analytics/countries?days=10"));
    expect(lakeMocks.getGscDimensionFromLake).toHaveBeenCalledWith("country", 10);
  });
});
