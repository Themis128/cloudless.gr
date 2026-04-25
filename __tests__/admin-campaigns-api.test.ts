import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const {
  googleConfiguredMock, googleCampaignsMock, googleMetricsMock,
  linkedinConfiguredMock, linkedinCampaignsMock, linkedinMetricsMock,
  tiktokConfiguredMock, tiktokCampaignsMock,
  xConfiguredMock, xCampaignsMock,
} = vi.hoisted(() => ({
  googleConfiguredMock: vi.fn(),
  googleCampaignsMock: vi.fn(),
  googleMetricsMock: vi.fn(),
  linkedinConfiguredMock: vi.fn(),
  linkedinCampaignsMock: vi.fn(),
  linkedinMetricsMock: vi.fn(),
  tiktokConfiguredMock: vi.fn(),
  tiktokCampaignsMock: vi.fn(),
  xConfiguredMock: vi.fn(),
  xCampaignsMock: vi.fn(),
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

vi.mock("@/lib/campaigns/google-ads", () => ({
  isGoogleAdsConfigured: googleConfiguredMock,
  listGoogleCampaigns: googleCampaignsMock,
  getGoogleMetrics: googleMetricsMock,
}));

vi.mock("@/lib/campaigns/linkedin", () => ({
  isLinkedInConfigured: linkedinConfiguredMock,
  listLinkedInCampaigns: linkedinCampaignsMock,
  getLinkedInMetrics: linkedinMetricsMock,
}));

vi.mock("@/lib/campaigns/tiktok", () => ({
  isTikTokConfigured: tiktokConfiguredMock,
  listTikTokCampaigns: tiktokCampaignsMock,
}));

vi.mock("@/lib/campaigns/x-ads", () => ({
  isXConfigured: xConfiguredMock,
  listXCampaigns: xCampaignsMock,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeAdminToken(): string {
  const payload = {
    sub: "test-admin-sub",
    email: "admin@cloudless.gr",
    "cognito:groups": ["admin"],
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

// ---------------------------------------------------------------------------
// Google Ads
// ---------------------------------------------------------------------------
describe("GET /api/admin/campaigns/google", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/campaigns/google/route");
    const res = await GET(unauthReq("http://localhost/api/admin/campaigns/google"));
    expect(res.status).toBe(401);
    expect(googleCampaignsMock).not.toHaveBeenCalled();
  });

  it("returns 503 when Google Ads not configured", async () => {
    googleConfiguredMock.mockResolvedValueOnce(false);
    const { GET } = await import("@/app/api/admin/campaigns/google/route");
    const res = await GET(adminReq("http://localhost/api/admin/campaigns/google"));
    const data = await res.json();
    expect(res.status).toBe(503);
    expect(data.error).toMatch(/Google Ads not configured/i);
  });

  it("returns campaigns list", async () => {
    googleConfiguredMock.mockResolvedValueOnce(true);
    googleCampaignsMock.mockResolvedValueOnce([
      { id: "c1", name: "Brand Awareness", status: "ENABLED" },
      { id: "c2", name: "Retargeting", status: "PAUSED" },
    ]);
    const { GET } = await import("@/app/api/admin/campaigns/google/route");
    const res = await GET(adminReq("http://localhost/api/admin/campaigns/google"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.campaigns).toHaveLength(2);
    expect(data.total).toBe(2);
  });
});

describe("GET /api/admin/campaigns/google/insights", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/campaigns/google/insights/route");
    const res = await GET(unauthReq("http://localhost/api/admin/campaigns/google/insights"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when not configured", async () => {
    googleConfiguredMock.mockResolvedValueOnce(false);
    const { GET } = await import("@/app/api/admin/campaigns/google/insights/route");
    const res = await GET(adminReq("http://localhost/api/admin/campaigns/google/insights"));
    expect(res.status).toBe(503);
  });

  it("returns metrics", async () => {
    googleConfiguredMock.mockResolvedValueOnce(true);
    googleMetricsMock.mockResolvedValueOnce({ impressions: 5000, clicks: 200, ctr: 4.0 });
    const { GET } = await import("@/app/api/admin/campaigns/google/insights/route");
    const res = await GET(adminReq("http://localhost/api/admin/campaigns/google/insights"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.metrics).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// LinkedIn
// ---------------------------------------------------------------------------
describe("GET /api/admin/campaigns/linkedin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/campaigns/linkedin/route");
    const res = await GET(unauthReq("http://localhost/api/admin/campaigns/linkedin"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when not configured", async () => {
    linkedinConfiguredMock.mockResolvedValueOnce(false);
    const { GET } = await import("@/app/api/admin/campaigns/linkedin/route");
    const res = await GET(adminReq("http://localhost/api/admin/campaigns/linkedin"));
    expect(res.status).toBe(503);
  });

  it("returns campaigns", async () => {
    linkedinConfiguredMock.mockResolvedValueOnce(true);
    linkedinCampaignsMock.mockResolvedValueOnce([
      { id: "lc1", name: "SaaS Decision Makers" },
    ]);
    const { GET } = await import("@/app/api/admin/campaigns/linkedin/route");
    const res = await GET(adminReq("http://localhost/api/admin/campaigns/linkedin"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.campaigns).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// TikTok
// ---------------------------------------------------------------------------
describe("GET /api/admin/campaigns/tiktok", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/campaigns/tiktok/route");
    const res = await GET(unauthReq("http://localhost/api/admin/campaigns/tiktok"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when not configured", async () => {
    tiktokConfiguredMock.mockResolvedValueOnce(false);
    const { GET } = await import("@/app/api/admin/campaigns/tiktok/route");
    const res = await GET(adminReq("http://localhost/api/admin/campaigns/tiktok"));
    const data = await res.json();
    expect(res.status).toBe(503);
    expect(data.error).toMatch(/TikTok not configured/i);
  });

  it("returns campaigns", async () => {
    tiktokConfiguredMock.mockResolvedValueOnce(true);
    tiktokCampaignsMock.mockResolvedValueOnce([{ id: "tt1", name: "Gen Z Reach" }]);
    const { GET } = await import("@/app/api/admin/campaigns/tiktok/route");
    const res = await GET(adminReq("http://localhost/api/admin/campaigns/tiktok"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.campaigns).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// X (Twitter)
// ---------------------------------------------------------------------------
describe("GET /api/admin/campaigns/x", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/campaigns/x/route");
    const res = await GET(unauthReq("http://localhost/api/admin/campaigns/x"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when not configured", async () => {
    xConfiguredMock.mockResolvedValueOnce(false);
    const { GET } = await import("@/app/api/admin/campaigns/x/route");
    const res = await GET(adminReq("http://localhost/api/admin/campaigns/x"));
    const data = await res.json();
    expect(res.status).toBe(503);
    expect(data.error).toMatch(/X.*not configured/i);
  });

  it("returns campaigns", async () => {
    xConfiguredMock.mockResolvedValueOnce(true);
    xCampaignsMock.mockResolvedValueOnce([{ id: "x1", name: "Promoted Posts" }]);
    const { GET } = await import("@/app/api/admin/campaigns/x/route");
    const res = await GET(adminReq("http://localhost/api/admin/campaigns/x"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.campaigns).toHaveLength(1);
  });
});
