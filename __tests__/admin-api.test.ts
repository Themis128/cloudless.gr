/**
 * Contract tests for /api/admin/** routes.
 *
 * Verifies auth enforcement (401 / 403), 503 when integrations are unconfigured,
 * and shape of successful responses using mocked third-party clients.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { resetIntegrationCache } from "@/lib/integrations";
import { resetSsmCache } from "@/lib/ssm-config";

// ---------------------------------------------------------------------------
// Mock jose: replace jwtVerify with a decode-only version so tests can use
// fake-signed tokens without hitting the real Cognito JWKS endpoint.
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

/** Build a mock admin JWT — groups encoded in payload, no real signature. */
function makeAdminToken(): string {
  const payload = {
    sub: "test-admin-sub",
    email: "admin@cloudless.gr",
    "cognito:username": "admin-user",
    "cognito:groups": ["admin"],
    aud: "test-client-id",
    iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-sig`;
}

/** Build a mock non-admin JWT. */
function makeUserToken(): string {
  const payload = {
    sub: "test-user-sub",
    email: "user@cloudless.gr",
    "cognito:username": "regular-user",
    "cognito:groups": [],
    aud: "test-client-id",
    iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-sig`;
}

function adminRequest(url: string, init?: RequestInit): NextRequest {
  const headers = new Headers({ Authorization: `Bearer ${makeAdminToken()}` });
  return new NextRequest(url, { method: init?.method, body: init?.body, headers });
}

function userRequest(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { Authorization: `Bearer ${makeUserToken()}` },
  });
}

function unauthRequest(url: string): NextRequest {
  return new NextRequest(url);
}

// ---------------------------------------------------------------------------
// Mocks — set up before any dynamic import
// ---------------------------------------------------------------------------

// Cognito
const mockCognitoSend = vi.fn();
vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: class {
    send = mockCognitoSend;
  },
  ListUsersCommand: class {
    constructor(public input: unknown) {}
  },
  AdminDisableUserCommand: class {
    constructor(public input: unknown) {}
  },
  AdminEnableUserCommand: class {
    constructor(public input: unknown) {}
  },
  AdminAddUserToGroupCommand: class {
    constructor(public input: unknown) {}
  },
  AdminRemoveUserFromGroupCommand: class {
    constructor(public input: unknown) {}
  },
  AdminListGroupsForUserCommand: class {
    constructor(public input: unknown) {}
  },
}));

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

// Google Search Console (GSC)
vi.mock("@/lib/gsc", () => ({
  getSeoSnapshot: vi.fn().mockResolvedValue({
    clicks: 500,
    impressions: 12000,
    ctr: 4.17,
    avgPosition: 14.2,
    organicKeywords: 87,
  }),
  getTopKeywords: vi.fn().mockResolvedValue([
    { keyword: "cloudless gr", clicks: 120, impressions: 3000, ctr: 4, position: 8.5 },
  ]),
  getTopPages: vi.fn().mockResolvedValue([
    { page: "https://cloudless.gr/", clicks: 200, impressions: 5000, ctr: 4, position: 7 },
  ]),
  getPerformanceHistory: vi.fn().mockResolvedValue([
    { date: "2025-01-01", clicks: 30, impressions: 600, ctr: 5, avgPosition: 11 },
  ]),
  getWebAnalytics: vi.fn().mockResolvedValue({
    clicks: 500,
    impressions: 12000,
    ctr: 4.17,
    avgPosition: 14.2,
    topPages: [{ page: "https://cloudless.gr/", clicks: 200, impressions: 5000, position: 7 }],
  }),
  getCtrOpportunities: vi.fn().mockResolvedValue([
    { keyword: "serverless nextjs", clicks: 10, impressions: 800, ctr: 1.25, position: 7.2 },
  ]),
  getDeviceBreakdown: vi.fn().mockResolvedValue([
    { device: "DESKTOP", clicks: 300, impressions: 6000, ctr: 5, avgPosition: 9 },
    { device: "MOBILE", clicks: 200, impressions: 5000, ctr: 4, avgPosition: 12 },
  ]),
  getProductPageMetrics: vi.fn().mockResolvedValue([
    { page: "https://cloudless.gr/store/pro-plan", clicks: 40, impressions: 900, ctr: 4.44, position: 8 },
  ]),
  getQueryPageMapping: vi.fn().mockResolvedValue([
    { query: "cloudless hosting", page: "https://cloudless.gr/", clicks: 60, impressions: 1500, ctr: 4, position: 6 },
  ]),
  getSearchIntentBreakdown: vi.fn().mockResolvedValue({
    brand: [{ keyword: "cloudless gr", clicks: 100, impressions: 2000, ctr: 5, position: 3 }],
    product: [],
    informational: [],
    navigational: [],
  }),
  getTrafficByCountry: vi.fn().mockResolvedValue([
    { country: "grc", clicks: 350, impressions: 7000, ctr: 5, avgPosition: 8 },
  ]),
}));

// HubSpot
vi.mock("@/lib/hubspot", () => ({
  listContacts: vi.fn().mockResolvedValue([
    { id: "1", email: "lead@example.com", firstName: "Test" },
  ]),
}));

// Slack notify
vi.mock("@/lib/slack-notify", () => ({
  slackNotify: vi.fn().mockResolvedValue(true),
}));

// Sentry
vi.mock("@/lib/sentry", () => ({
  isSentryConfigured: vi.fn().mockReturnValue(true),
  getUnresolvedIssues: vi.fn().mockResolvedValue({
    issues: [],
    total: 0,
    fetchedAt: new Date().toISOString(),
  }),
}));


// ---------------------------------------------------------------------------
// /api/admin/users
// ---------------------------------------------------------------------------

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // USER_POOL_ID is read at module-load time, so each test needs fresh import
    resetIntegrationCache();
    process.env.COGNITO_USER_POOL_ID = "us-east-1_test";

    mockCognitoSend.mockImplementation((cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === "ListUsersCommand") {
        return Promise.resolve({
          Users: [
            {
              Username: "user-1",
              Enabled: true,
              UserStatus: "CONFIRMED",
              UserCreateDate: new Date("2024-01-01"),
              UserLastModifiedDate: new Date("2024-06-01"),
              Attributes: [
                { Name: "email", Value: "user1@example.com" },
                { Name: "name", Value: "User One" },
              ],
            },
          ],
        });
      }
      // AdminListGroupsForUserCommand
      return Promise.resolve({ Groups: [] });
    });
  });

  it("returns 401 when no token is provided", async () => {
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(unauthRequest("http://localhost/api/admin/users"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when token has no admin group", async () => {
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(userRequest("http://localhost/api/admin/users"));
    expect(res.status).toBe(403);
  });

  it("returns 503 when Cognito pool is not configured", async () => {
    process.env.COGNITO_USER_POOL_ID = "";
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(adminRequest("http://localhost/api/admin/users"));
    expect(res.status).toBe(503);
    process.env.COGNITO_USER_POOL_ID = "us-east-1_test";
  });

  it("returns user list for admin", async () => {
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(adminRequest("http://localhost/api/admin/users"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.users)).toBe(true);
    expect(typeof data.count).toBe("number");
    const u = data.users[0];
    expect(u).toMatchObject({
      username: "user-1",
      email: "user1@example.com",
      status: "active",
      userStatus: "CONFIRMED",
      role: "user",
    });
  });

  it("user objects expose role field", async () => {
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(adminRequest("http://localhost/api/admin/users"));
    const data = await res.json();
    expect(data.users[0].role).toMatch(/^(admin|user)$/);
  });
});

describe("POST /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COGNITO_USER_POOL_ID = "us-east-1_test";
    mockCognitoSend.mockResolvedValue({});
  });

  async function postAction(body: object) {
    const { POST } = await import("@/app/api/admin/users/route");
    return POST(
      adminRequest("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  it("returns 401 without token", async () => {
    const { POST } = await import("@/app/api/admin/users/route");
    const res = await POST(
      new NextRequest("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ action: "disable", username: "x" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when action is missing", async () => {
    const res = await postAction({ username: "user-1" });
    expect(res.status).toBe(400);
  });

  it("disable action succeeds", async () => {
    const res = await postAction({ action: "disable", username: "user-1" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("enable action succeeds", async () => {
    const res = await postAction({ action: "enable", username: "user-1" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("promote action succeeds", async () => {
    const res = await postAction({
      action: "promote",
      username: "user-1",
      groupName: "admin",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("returns 400 for unknown action", async () => {
    const res = await postAction({ action: "nuke", username: "user-1" });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// /api/admin/orders
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
            data: [
              { description: "Pro Plan", quantity: 1, amount_total: 4900 },
            ],
          },
          created: 1700000000,
        },
      ],
    });
    mockStripeSubs.mockResolvedValue({ data: [] });
  });

  it("returns 401 without token", async () => {
    const { GET } = await import("@/app/api/admin/orders/route");
    const res = await GET(unauthRequest("http://localhost/api/admin/orders"));
    expect(res.status).toBe(401);
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
// /api/admin/analytics/web  (Google Search Console)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/web", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSsmCache();
  });

  it("returns 503 when GSC credentials are missing", async () => {
    vi.stubEnv("GOOGLE_CLIENT_EMAIL", "");
    resetSsmCache();
    const { GET } = await import("@/app/api/admin/analytics/web/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/web"));
    expect(res.status).toBe(503);
  });

  it("returns analytics payload when GSC is configured", async () => {
    const { GET } = await import("@/app/api/admin/analytics/web/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/web"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("analytics");
    expect(typeof data.fetchedAt).toBe("string");
    expect(data.source).toBe("google-search-console");
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/seo  (Google Search Console)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/seo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSsmCache();
  });

  it("returns 503 when GSC credentials are not configured", async () => {
    vi.stubEnv("GOOGLE_CLIENT_EMAIL", "");
    resetSsmCache();
    const { GET } = await import("@/app/api/admin/analytics/seo/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/seo"));
    expect(res.status).toBe(503);
  });

  it("returns snapshot + keywords when GSC is configured", async () => {
    const { GET } = await import("@/app/api/admin/analytics/seo/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/seo"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("snapshot");
    expect(Array.isArray(data.keywords)).toBe(true);
    expect(typeof data.fetchedAt).toBe("string");
    expect(data.source).toBe("google-search-console");
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

  it("returns 401 without token", async () => {
    const { GET } = await import("@/app/api/admin/crm/contacts/route");
    const res = await GET(
      unauthRequest("http://localhost/api/admin/crm/contacts"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 503 when HubSpot is not configured", async () => {
    vi.stubEnv("HUBSPOT_API_KEY", "");
    resetIntegrationCache();
    const { GET } = await import("@/app/api/admin/crm/contacts/route");
    const res = await GET(
      adminRequest("http://localhost/api/admin/crm/contacts"),
    );
    expect(res.status).toBe(503);
  });

  it("returns contact list for admin", async () => {
    const { GET } = await import("@/app/api/admin/crm/contacts/route");
    const res = await GET(
      adminRequest("http://localhost/api/admin/crm/contacts"),
    );
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
  });

  it("returns 503 when Slack is not configured", async () => {
    vi.stubEnv("SLACK_WEBHOOK_URL", "");
    resetIntegrationCache();
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
// /api/admin/analytics/keywords  (GSC)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/keywords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSsmCache();
  });

  it("returns 503 when GSC credentials are missing", async () => {
    vi.stubEnv("GOOGLE_CLIENT_EMAIL", "");
    resetSsmCache();
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/keywords"));
    expect(res.status).toBe(503);
  });

  it("returns keywords array when configured", async () => {
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/keywords"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.keywords)).toBe(true);
    expect(typeof data.fetchedAt).toBe("string");
    expect(data.source).toBe("google-search-console");
  });

  it("respects ?limit query param", async () => {
    const { getTopKeywords } = await import("@/lib/gsc");
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    await GET(adminRequest("http://localhost/api/admin/analytics/keywords?limit=5"));
    expect(getTopKeywords).toHaveBeenCalledWith(undefined, 5);
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/pages  (GSC)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSsmCache();
  });

  it("returns 503 when GSC credentials are missing", async () => {
    vi.stubEnv("GOOGLE_CLIENT_EMAIL", "");
    resetSsmCache();
    const { GET } = await import("@/app/api/admin/analytics/pages/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/pages"));
    expect(res.status).toBe(503);
  });

  it("returns pages array when configured", async () => {
    const { GET } = await import("@/app/api/admin/analytics/pages/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/pages"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.pages)).toBe(true);
    expect(data.source).toBe("google-search-console");
  });

  it("respects ?limit query param", async () => {
    const { getTopPages } = await import("@/lib/gsc");
    const { GET } = await import("@/app/api/admin/analytics/pages/route");
    await GET(adminRequest("http://localhost/api/admin/analytics/pages?limit=10"));
    expect(getTopPages).toHaveBeenCalledWith(undefined, 10);
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/history  (GSC)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSsmCache();
  });

  it("returns 503 when GSC credentials are missing", async () => {
    vi.stubEnv("GOOGLE_CLIENT_EMAIL", "");
    resetSsmCache();
    const { GET } = await import("@/app/api/admin/analytics/history/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/history"));
    expect(res.status).toBe(503);
  });

  it("returns history array when configured", async () => {
    const { GET } = await import("@/app/api/admin/analytics/history/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/history"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.history)).toBe(true);
    expect(typeof data.weeks).toBe("number");
    expect(data.source).toBe("google-search-console");
  });

  it("respects ?weeks query param", async () => {
    const { getPerformanceHistory } = await import("@/lib/gsc");
    const { GET } = await import("@/app/api/admin/analytics/history/route");
    await GET(adminRequest("http://localhost/api/admin/analytics/history?weeks=4"));
    expect(getPerformanceHistory).toHaveBeenCalledWith(undefined, 4);
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/ctr-opportunities  (GSC)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/ctr-opportunities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSsmCache();
  });

  it("returns 503 when GSC credentials are missing", async () => {
    vi.stubEnv("GOOGLE_CLIENT_EMAIL", "");
    resetSsmCache();
    const { GET } = await import("@/app/api/admin/analytics/ctr-opportunities/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/ctr-opportunities"));
    expect(res.status).toBe(503);
  });

  it("returns opportunities array when configured", async () => {
    const { GET } = await import("@/app/api/admin/analytics/ctr-opportunities/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/ctr-opportunities"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.opportunities)).toBe(true);
    expect(typeof data.fetchedAt).toBe("string");
    expect(data.source).toBe("google-search-console");
  });

  it("respects ?limit query param", async () => {
    const { getCtrOpportunities } = await import("@/lib/gsc");
    const { GET } = await import("@/app/api/admin/analytics/ctr-opportunities/route");
    await GET(adminRequest("http://localhost/api/admin/analytics/ctr-opportunities?limit=20"));
    expect(getCtrOpportunities).toHaveBeenCalledWith(undefined, 20);
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/devices  (GSC)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/devices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSsmCache();
  });

  it("returns 503 when GSC credentials are missing", async () => {
    vi.stubEnv("GOOGLE_CLIENT_EMAIL", "");
    resetSsmCache();
    const { GET } = await import("@/app/api/admin/analytics/devices/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/devices"));
    expect(res.status).toBe(503);
  });

  it("returns devices array when configured", async () => {
    const { GET } = await import("@/app/api/admin/analytics/devices/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/devices"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.devices)).toBe(true);
    expect(data.source).toBe("google-search-console");
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/products  (GSC)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSsmCache();
  });

  it("returns 503 when GSC credentials are missing", async () => {
    vi.stubEnv("GOOGLE_CLIENT_EMAIL", "");
    resetSsmCache();
    const { GET } = await import("@/app/api/admin/analytics/products/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/products"));
    expect(res.status).toBe(503);
  });

  it("returns products array when configured", async () => {
    const { GET } = await import("@/app/api/admin/analytics/products/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/products"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.products)).toBe(true);
    expect(typeof data.pattern).toBe("string");
    expect(data.source).toBe("google-search-console");
  });

  it("respects ?pattern and ?limit query params", async () => {
    const { getProductPageMetrics } = await import("@/lib/gsc");
    const { GET } = await import("@/app/api/admin/analytics/products/route");
    await GET(adminRequest("http://localhost/api/admin/analytics/products?pattern=/blog/&limit=10"));
    expect(getProductPageMetrics).toHaveBeenCalledWith(undefined, "/blog/", 10);
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/query-pages  (GSC)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/query-pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSsmCache();
  });

  it("returns 503 when GSC credentials are missing", async () => {
    vi.stubEnv("GOOGLE_CLIENT_EMAIL", "");
    resetSsmCache();
    const { GET } = await import("@/app/api/admin/analytics/query-pages/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/query-pages"));
    expect(res.status).toBe(503);
  });

  it("returns mappings array when configured", async () => {
    const { GET } = await import("@/app/api/admin/analytics/query-pages/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/query-pages"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.mappings)).toBe(true);
    expect(data.source).toBe("google-search-console");
  });

  it("respects ?limit query param", async () => {
    const { getQueryPageMapping } = await import("@/lib/gsc");
    const { GET } = await import("@/app/api/admin/analytics/query-pages/route");
    await GET(adminRequest("http://localhost/api/admin/analytics/query-pages?limit=50"));
    expect(getQueryPageMapping).toHaveBeenCalledWith(undefined, 50);
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/search-intent  (GSC)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/search-intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSsmCache();
  });

  it("returns 503 when GSC credentials are missing", async () => {
    vi.stubEnv("GOOGLE_CLIENT_EMAIL", "");
    resetSsmCache();
    const { GET } = await import("@/app/api/admin/analytics/search-intent/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/search-intent"));
    expect(res.status).toBe(503);
  });

  it("returns intent breakdown with summary when configured", async () => {
    const { GET } = await import("@/app/api/admin/analytics/search-intent/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/search-intent"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("intent");
    expect(data).toHaveProperty("summary");
    expect(typeof data.summary.brand).toBe("number");
    expect(data.source).toBe("google-search-console");
  });
});

// ---------------------------------------------------------------------------
// /api/admin/analytics/countries  (GSC)
// ---------------------------------------------------------------------------

describe("GET /api/admin/analytics/countries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSsmCache();
  });

  it("returns 503 when GSC credentials are missing", async () => {
    vi.stubEnv("GOOGLE_CLIENT_EMAIL", "");
    resetSsmCache();
    const { GET } = await import("@/app/api/admin/analytics/countries/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/countries"));
    expect(res.status).toBe(503);
  });

  it("returns countries array when configured", async () => {
    const { GET } = await import("@/app/api/admin/analytics/countries/route");
    const res = await GET(adminRequest("http://localhost/api/admin/analytics/countries"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.countries)).toBe(true);
    expect(data.source).toBe("google-search-console");
  });

  it("respects ?limit query param", async () => {
    const { getTrafficByCountry } = await import("@/lib/gsc");
    const { GET } = await import("@/app/api/admin/analytics/countries/route");
    await GET(adminRequest("http://localhost/api/admin/analytics/countries?limit=10"));
    expect(getTrafficByCountry).toHaveBeenCalledWith(undefined, 10);
  });
});
