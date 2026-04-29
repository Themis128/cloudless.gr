import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { getConfigMock, gscMocks } = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
  gscMocks: {
    getWebAnalytics: vi.fn(),
    getSeoSnapshot: vi.fn(),
    getTopKeywords: vi.fn(),
    getDeviceBreakdown: vi.fn(),
    getTrafficByCountry: vi.fn(),
    getPerformanceHistory: vi.fn(),
    getTopPages: vi.fn(),
    getProductPageMetrics: vi.fn(),
    getCtrOpportunities: vi.fn(),
    getQueryPageMapping: vi.fn(),
    getSearchIntentBreakdown: vi.fn(),
  },
}));

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

vi.mock("@/lib/ssm-config", () => ({
  getConfig: getConfigMock,
}));

vi.mock("@/lib/gsc", () => ({
  getWebAnalytics: gscMocks.getWebAnalytics,
  getSeoSnapshot: gscMocks.getSeoSnapshot,
  getTopKeywords: gscMocks.getTopKeywords,
  getDeviceBreakdown: gscMocks.getDeviceBreakdown,
  getTrafficByCountry: gscMocks.getTrafficByCountry,
  getPerformanceHistory: gscMocks.getPerformanceHistory,
  getTopPages: gscMocks.getTopPages,
  getProductPageMetrics: gscMocks.getProductPageMetrics,
  getCtrOpportunities: gscMocks.getCtrOpportunities,
  getQueryPageMapping: gscMocks.getQueryPageMapping,
  getSearchIntentBreakdown: gscMocks.getSearchIntentBreakdown,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeAdminToken(): string {
  const payload = {
    sub: "test-admin-sub",
    email: "admin@cloudless.gr",
    "cognito:groups": ["admin"],
    token_use: "id",
    aud: "test-client-id",
    iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TestPool",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-sig`;
}

function adminReq(url: string): NextRequest {
  return new NextRequest(url, { headers: { Authorization: `Bearer ${makeAdminToken()}` } });
}

function unauthReq(url: string): NextRequest {
  return new NextRequest(url);
}

const gscConfigured = { GOOGLE_CLIENT_EMAIL: "svc@test.iam.gserviceaccount.com", GOOGLE_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----" };
const gscUnconfigured = {};

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/web
// ---------------------------------------------------------------------------
describe("GET /api/admin/analytics/web", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/web/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/web"));
    expect(res.status).toBe(401);
    expect(gscMocks.getWebAnalytics).not.toHaveBeenCalled();
  });

  it("returns 503 when GSC not configured", async () => {
    getConfigMock.mockResolvedValue(gscUnconfigured);
    const { GET } = await import("@/app/api/admin/analytics/web/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/web"));
    const data = await res.json();
    expect(res.status).toBe(503);
    expect(data.error).toMatch(/not configured/i);
  });

  it("returns analytics data", async () => {
    getConfigMock.mockResolvedValue(gscConfigured);
    gscMocks.getWebAnalytics.mockResolvedValue({ clicks: 500, impressions: 10000, ctr: 0.05, position: 12.3 });
    const { GET } = await import("@/app/api/admin/analytics/web/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/web"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.analytics).toBeDefined();
    expect(data.source).toBe("google-search-console");
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/seo
// ---------------------------------------------------------------------------
describe("GET /api/admin/analytics/seo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/seo/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/seo"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when GSC not configured", async () => {
    getConfigMock.mockResolvedValue(gscUnconfigured);
    const { GET } = await import("@/app/api/admin/analytics/seo/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/seo"));
    expect(res.status).toBe(503);
  });

  it("returns snapshot and keywords", async () => {
    getConfigMock.mockResolvedValue(gscConfigured);
    gscMocks.getSeoSnapshot.mockResolvedValue({ totalClicks: 1200, avgPosition: 8.4 });
    gscMocks.getTopKeywords.mockResolvedValue([{ query: "cloudless ai", clicks: 80, position: 3.1 }]);
    const { GET } = await import("@/app/api/admin/analytics/seo/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/seo"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.snapshot).toBeDefined();
    expect(data.keywords).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/devices
// ---------------------------------------------------------------------------
describe("GET /api/admin/analytics/devices", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/devices/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/devices"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when GSC not configured", async () => {
    getConfigMock.mockResolvedValue(gscUnconfigured);
    const { GET } = await import("@/app/api/admin/analytics/devices/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/devices"));
    expect(res.status).toBe(503);
  });

  it("returns device breakdown", async () => {
    getConfigMock.mockResolvedValue(gscConfigured);
    gscMocks.getDeviceBreakdown.mockResolvedValue([
      { device: "DESKTOP", clicks: 300 },
      { device: "MOBILE", clicks: 200 },
    ]);
    const { GET } = await import("@/app/api/admin/analytics/devices/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/devices"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.devices).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/keywords
// ---------------------------------------------------------------------------
describe("GET /api/admin/analytics/keywords", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/keywords"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when GSC not configured", async () => {
    getConfigMock.mockResolvedValue(gscUnconfigured);
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/keywords"));
    expect(res.status).toBe(503);
  });

  it("returns keywords list", async () => {
    getConfigMock.mockResolvedValue(gscConfigured);
    gscMocks.getTopKeywords.mockResolvedValue([
      { query: "digital agency greece", clicks: 45, impressions: 600, ctr: 0.075, position: 4.2 },
    ]);
    const { GET } = await import("@/app/api/admin/analytics/keywords/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/keywords"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.keywords).toHaveLength(1);
    expect(data.keywords[0].query).toBe("digital agency greece");
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/countries
// ---------------------------------------------------------------------------
describe("GET /api/admin/analytics/countries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/countries/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/countries"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when GSC not configured", async () => {
    getConfigMock.mockResolvedValue(gscUnconfigured);
    const { GET } = await import("@/app/api/admin/analytics/countries/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/countries"));
    expect(res.status).toBe(503);
  });

  it("returns country data", async () => {
    getConfigMock.mockResolvedValue(gscConfigured);
    gscMocks.getTrafficByCountry.mockResolvedValue([
      { country: "grc", clicks: 280, impressions: 4000 },
      { country: "usa", clicks: 120, impressions: 2000 },
    ]);
    const { GET } = await import("@/app/api/admin/analytics/countries/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/countries"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.countries).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/history
// ---------------------------------------------------------------------------
describe("GET /api/admin/analytics/history", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/history/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/history"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when GSC not configured", async () => {
    getConfigMock.mockResolvedValue(gscUnconfigured);
    const { GET } = await import("@/app/api/admin/analytics/history/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/history"));
    expect(res.status).toBe(503);
  });

  it("returns performance history", async () => {
    getConfigMock.mockResolvedValue(gscConfigured);
    gscMocks.getPerformanceHistory.mockResolvedValue([
      { week: "2024-W01", clicks: 100, impressions: 1500 },
      { week: "2024-W02", clicks: 120, impressions: 1700 },
    ]);
    const { GET } = await import("@/app/api/admin/analytics/history/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/history"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.history).toHaveLength(2);
    expect(data.weeks).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/pages
// ---------------------------------------------------------------------------
describe("GET /api/admin/analytics/pages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/pages/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/pages"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when GSC not configured", async () => {
    getConfigMock.mockResolvedValue(gscUnconfigured);
    const { GET } = await import("@/app/api/admin/analytics/pages/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/pages"));
    expect(res.status).toBe(503);
  });

  it("returns top pages", async () => {
    getConfigMock.mockResolvedValue(gscConfigured);
    gscMocks.getTopPages.mockResolvedValue([
      { page: "/en/", clicks: 200, impressions: 3000, ctr: 0.067, position: 5.1 },
    ]);
    const { GET } = await import("@/app/api/admin/analytics/pages/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/pages"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.pages).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/products
// ---------------------------------------------------------------------------
describe("GET /api/admin/analytics/products", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/products/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/products"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when GSC not configured", async () => {
    getConfigMock.mockResolvedValue(gscUnconfigured);
    const { GET } = await import("@/app/api/admin/analytics/products/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/products"));
    expect(res.status).toBe(503);
  });

  it("returns product page metrics", async () => {
    getConfigMock.mockResolvedValue(gscConfigured);
    gscMocks.getProductPageMetrics.mockResolvedValue([
      { page: "/en/store/ai-seo-bundle", clicks: 50, impressions: 800 },
    ]);
    const { GET } = await import("@/app/api/admin/analytics/products/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/products?pattern=/store/"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.products).toHaveLength(1);
    expect(data.pattern).toBe("/store/");
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/ctr-opportunities
// ---------------------------------------------------------------------------
describe("GET /api/admin/analytics/ctr-opportunities", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/ctr-opportunities/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/ctr-opportunities"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when GSC not configured", async () => {
    getConfigMock.mockResolvedValue(gscUnconfigured);
    const { GET } = await import("@/app/api/admin/analytics/ctr-opportunities/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/ctr-opportunities"));
    expect(res.status).toBe(503);
  });

  it("returns CTR opportunities", async () => {
    getConfigMock.mockResolvedValue(gscConfigured);
    gscMocks.getCtrOpportunities.mockResolvedValue([
      { query: "seo agency athens", impressions: 500, ctr: 0.02, position: 7.8 },
    ]);
    const { GET } = await import("@/app/api/admin/analytics/ctr-opportunities/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/ctr-opportunities"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.opportunities).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/query-pages
// ---------------------------------------------------------------------------
describe("GET /api/admin/analytics/query-pages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/query-pages/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/query-pages"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when GSC not configured", async () => {
    getConfigMock.mockResolvedValue(gscUnconfigured);
    const { GET } = await import("@/app/api/admin/analytics/query-pages/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/query-pages"));
    expect(res.status).toBe(503);
  });

  it("returns query-page mappings", async () => {
    getConfigMock.mockResolvedValue(gscConfigured);
    gscMocks.getQueryPageMapping.mockResolvedValue([
      { query: "ai marketing tool", page: "/en/store/ai-marketing", clicks: 30 },
    ]);
    const { GET } = await import("@/app/api/admin/analytics/query-pages/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/query-pages"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.mappings).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/search-intent
// ---------------------------------------------------------------------------
describe("GET /api/admin/analytics/search-intent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/analytics/search-intent/route");
    const res = await GET(unauthReq("http://localhost/api/admin/analytics/search-intent"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when GSC not configured", async () => {
    getConfigMock.mockResolvedValue(gscUnconfigured);
    const { GET } = await import("@/app/api/admin/analytics/search-intent/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/search-intent"));
    expect(res.status).toBe(503);
  });

  it("returns search intent breakdown", async () => {
    getConfigMock.mockResolvedValue(gscConfigured);
    gscMocks.getSearchIntentBreakdown.mockResolvedValue({
      brand: [{ query: "cloudless.gr" }],
      product: [{ query: "ai seo tool" }],
      informational: [{ query: "what is programmatic seo" }],
      navigational: [{ query: "cloudless login" }],
    });
    const { GET } = await import("@/app/api/admin/analytics/search-intent/route");
    const res = await GET(adminReq("http://localhost/api/admin/analytics/search-intent"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.intent).toBeDefined();
    expect(data.summary.brand).toBe(1);
    expect(data.summary.product).toBe(1);
    expect(data.summary.informational).toBe(1);
    expect(data.summary.navigational).toBe(1);
  });
});
