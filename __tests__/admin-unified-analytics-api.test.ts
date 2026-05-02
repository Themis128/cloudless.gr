import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const ANALYTICS_URL = "http://localhost/api/admin/analytics/unified";
const ALG_RS256 = "RS256";
const ENC_BASE64URL = "base64url";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockGetConfig, mockIsHubSpot, mockIsAC } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockIsHubSpot: vi.fn(),
  mockIsAC: vi.fn(),
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT");
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      if (payload.exp && Date.now() >= payload.exp * 1000) throw new Error("expired");
      return { payload, protectedHeader: { alg: ALG_RS256 } };
    },
  };
});

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));

vi.mock("@/lib/gsc", () => ({
  getSeoSnapshot: vi.fn().mockResolvedValue({
    clicks: 400, impressions: 8000, ctr: 0.05, avgPosition: 12,
  }),
}));

vi.mock("@/lib/hubspot", () => ({
  isHubSpotConfigured: mockIsHubSpot,
  getPipelineStats: vi.fn().mockResolvedValue({
    totalDeals: 5, totalValue: 150000, stages: {},
  }),
}));

vi.mock("@/lib/activecampaign", () => ({
  isActiveCampaignConfigured: mockIsAC,
  getEmailStats: vi.fn().mockResolvedValue({
    totalContacts: 200, totalCampaigns: 3, openRate: 0.25, clickRate: 0.1,
  }),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn().mockResolvedValue({
    checkout: {
      sessions: {
        list: vi.fn().mockResolvedValue({
          data: [
            { payment_status: "paid", amount_total: 4900 },
            { payment_status: "unpaid", amount_total: 0 },
          ],
        }),
      },
    },
  }),
}));

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
function makeAdminToken(): string {
  const payload = {
    sub: "admin-sub",
    email: "admin@test.com",
    "cognito:groups": ["admin"],
    aud: "test-client",
    iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const h = Buffer.from(JSON.stringify({ alg: ALG_RS256 })).toString(ENC_BASE64URL);
  const b = Buffer.from(JSON.stringify(payload)).toString(ENC_BASE64URL);
  return `${h}.${b}.sig`;
}

function makeUserToken(): string {
  const payload = {
    sub: "user-sub",
    "cognito:groups": [],
    aud: "test-client",
    iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const h = Buffer.from(JSON.stringify({ alg: ALG_RS256 })).toString(ENC_BASE64URL);
  const b = Buffer.from(JSON.stringify(payload)).toString(ENC_BASE64URL);
  return `${h}.${b}.sig`;
}

function adminReq(url: string): NextRequest {
  return new NextRequest(url, { headers: { Authorization: `Bearer ${makeAdminToken()}` } });
}

function userReq(url: string): NextRequest {
  return new NextRequest(url, { headers: { Authorization: `Bearer ${makeUserToken()}` } });
}

const BASE_CFG = {
  STRIPE_SECRET_KEY: "sk_test_x",
  GOOGLE_CLIENT_EMAIL: "svc@test.iam",
  GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----",
  NOTION_API_KEY: "", NOTION_PROJECTS_DB_ID: "",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GET /api/admin/analytics/unified", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue(BASE_CFG);
    mockIsHubSpot.mockResolvedValue(true);
    mockIsAC.mockResolvedValue(true);
  });

  it("returns 401 without token", async () => {
    const { GET } = await import("@/app/api/admin/analytics/unified/route");
    const res = await GET(new NextRequest(ANALYTICS_URL));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    const { GET } = await import("@/app/api/admin/analytics/unified/route");
    const res = await GET(userReq(ANALYTICS_URL));
    expect(res.status).toBe(403);
  });

  it("returns 200 with all sources when all configured", async () => {
    const { GET } = await import("@/app/api/admin/analytics/unified/route");
    const res = await GET(adminReq(ANALYTICS_URL));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("stripe");
    expect(data).toHaveProperty("seo");
    expect(data).toHaveProperty("pipeline");
    expect(data).toHaveProperty("email");
    expect(typeof data.fetchedAt).toBe("string");
  });

  it("returns null seo when GSC not configured", async () => {
    mockGetConfig.mockResolvedValue({ ...BASE_CFG, GOOGLE_CLIENT_EMAIL: "", GOOGLE_PRIVATE_KEY: "" });
    const { GET } = await import("@/app/api/admin/analytics/unified/route");
    const res = await GET(adminReq(ANALYTICS_URL));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.seo).toBeNull();
  });

  it("returns null pipeline when HubSpot not configured", async () => {
    mockIsHubSpot.mockResolvedValue(false);
    const { GET } = await import("@/app/api/admin/analytics/unified/route");
    const res = await GET(adminReq(ANALYTICS_URL));
    const data = await res.json();
    expect(data.pipeline).toBeNull();
  });

  it("returns null email when ActiveCampaign not configured", async () => {
    mockIsAC.mockResolvedValue(false);
    const { GET } = await import("@/app/api/admin/analytics/unified/route");
    const res = await GET(adminReq(ANALYTICS_URL));
    const data = await res.json();
    expect(data.email).toBeNull();
  });

  it("returns null stripe when not configured", async () => {
    mockGetConfig.mockResolvedValue({ ...BASE_CFG, STRIPE_SECRET_KEY: "" });
    const { GET } = await import("@/app/api/admin/analytics/unified/route");
    const res = await GET(adminReq(ANALYTICS_URL));
    const data = await res.json();
    expect(data.stripe).toBeNull();
  });
});
