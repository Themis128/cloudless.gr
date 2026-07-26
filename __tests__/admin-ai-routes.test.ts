/**
 * Unit tests for admin AI + campaign insights + email campaign routes:
 *   POST /api/admin/ai/report-insights
 *   GET  /api/admin/campaigns/linkedin/insights
 *   GET  /api/admin/campaigns/tiktok/insights
 *   GET  /api/admin/campaigns/x/insights
 *   GET  /api/admin/email/campaigns/[id]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
  requireAuth: vi.fn(),
}));

function adminOk() {
  mockRequireAdmin.mockResolvedValue({ ok: true, user: { sub: "a1" } });
}
function adminFail() {
  mockRequireAdmin.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
}
function req(url: string, method = "GET", body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

// ── /api/admin/ai/report-insights ────────────────────────────────────────────

const mockCallClaude = vi.fn();
const mockGetAnthropicApiKey = vi.fn();
vi.mock("@/lib/anthropic", () => ({
  callClaude: (...a: unknown[]) => mockCallClaude(...a),
  getAnthropicApiKey: (...a: unknown[]) => mockGetAnthropicApiKey(...a),
}));

describe("POST /api/admin/ai/report-insights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { POST } = await import("@/app/api/admin/ai/report-insights/route");
    const res = await POST(
      req("http://localhost/api/admin/ai/report-insights", "POST", { metrics: {}, period: "30d" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when metrics missing", async () => {
    adminOk();
    const { POST } = await import("@/app/api/admin/ai/report-insights/route");
    const res = await POST(
      req("http://localhost/api/admin/ai/report-insights", "POST", { period: "30d" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    adminOk();
    const { POST } = await import("@/app/api/admin/ai/report-insights/route");
    const r = new NextRequest("http://localhost/api/admin/ai/report-insights", {
      method: "POST",
      body: "bad-json",
    });
    const res = await POST(r);
    expect(res.status).toBe(400);
  });

  it("returns 503 when Anthropic key not configured", async () => {
    adminOk();
    mockGetAnthropicApiKey.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/ai/report-insights/route");
    const res = await POST(
      req("http://localhost/api/admin/ai/report-insights", "POST", {
        metrics: { clicks: 100 },
        period: "30d",
      })
    );
    expect(res.status).toBe(503);
  });

  it("returns insights when configured", async () => {
    adminOk();
    mockGetAnthropicApiKey.mockResolvedValue("sk-ant-xxx");
    mockCallClaude.mockResolvedValue("Campaign performed well with 100 clicks.");
    const { POST } = await import("@/app/api/admin/ai/report-insights/route");
    const res = await POST(
      req("http://localhost/api/admin/ai/report-insights", "POST", {
        metrics: { clicks: 100 },
        period: "30d",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.insights).toContain("100 clicks");
  });

  it("returns 500 when Claude call fails", async () => {
    adminOk();
    mockGetAnthropicApiKey.mockResolvedValue("sk-ant-xxx");
    mockCallClaude.mockRejectedValue(new Error("API error"));
    const { POST } = await import("@/app/api/admin/ai/report-insights/route");
    const res = await POST(
      req("http://localhost/api/admin/ai/report-insights", "POST", { metrics: { clicks: 100 } })
    );
    expect(res.status).toBe(500);
  });
});

// ── Campaign insights routes ──────────────────────────────────────────────────

const mockIsLinkedInConfigured = vi.fn();
const mockGetLinkedInInsights = vi.fn();
vi.mock("@/lib/campaigns/linkedin", async (orig) => ({
  ...(await orig<typeof import("@/lib/campaigns/linkedin")>()),
  isLinkedInConfigured: (...a: unknown[]) => mockIsLinkedInConfigured(...a),
  getLinkedInInsights: (...a: unknown[]) => mockGetLinkedInInsights(...a),
}));

describe("GET /api/admin/campaigns/linkedin/insights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { GET } = await import("@/app/api/admin/campaigns/linkedin/insights/route");
    const res = await GET(req("http://localhost/api/admin/campaigns/linkedin/insights"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when LinkedIn not configured", async () => {
    adminOk();
    mockIsLinkedInConfigured.mockResolvedValue(false);
    const { GET } = await import("@/app/api/admin/campaigns/linkedin/insights/route");
    const res = await GET(req("http://localhost/api/admin/campaigns/linkedin/insights"));
    expect(res.status).toBe(503);
  });

  it("returns insights when configured", async () => {
    adminOk();
    mockIsLinkedInConfigured.mockResolvedValue(true);
    mockGetLinkedInInsights.mockResolvedValue({ impressions: 1000, clicks: 50 });
    const { GET } = await import("@/app/api/admin/campaigns/linkedin/insights/route");
    const res = await GET(
      req("http://localhost/api/admin/campaigns/linkedin/insights?start=2024-01-01&end=2024-01-31")
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.insights.impressions).toBe(1000);
  });
});

const mockIsTikTokConfigured = vi.fn();
const mockGetTikTokInsights = vi.fn();
vi.mock("@/lib/campaigns/tiktok", async (orig) => ({
  ...(await orig<typeof import("@/lib/campaigns/tiktok")>()),
  isTikTokConfigured: (...a: unknown[]) => mockIsTikTokConfigured(...a),
  getTikTokInsights: (...a: unknown[]) => mockGetTikTokInsights(...a),
}));

describe("GET /api/admin/campaigns/tiktok/insights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { GET } = await import("@/app/api/admin/campaigns/tiktok/insights/route");
    const res = await GET(req("http://localhost/api/admin/campaigns/tiktok/insights"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when TikTok not configured", async () => {
    adminOk();
    mockIsTikTokConfigured.mockResolvedValue(false);
    const { GET } = await import("@/app/api/admin/campaigns/tiktok/insights/route");
    const res = await GET(req("http://localhost/api/admin/campaigns/tiktok/insights"));
    expect(res.status).toBe(503);
  });

  it("returns insights when configured", async () => {
    adminOk();
    mockIsTikTokConfigured.mockResolvedValue(true);
    mockGetTikTokInsights.mockResolvedValue({ spend: 500, impressions: 20000 });
    const { GET } = await import("@/app/api/admin/campaigns/tiktok/insights/route");
    const res = await GET(req("http://localhost/api/admin/campaigns/tiktok/insights"));
    expect(res.status).toBe(200);
  });
});

const mockIsXConfigured = vi.fn();
const mockGetXStats = vi.fn();
vi.mock("@/lib/campaigns/x-ads", async (orig) => ({
  ...(await orig<typeof import("@/lib/campaigns/x-ads")>()),
  isXConfigured: (...a: unknown[]) => mockIsXConfigured(...a),
  getXStats: (...a: unknown[]) => mockGetXStats(...a),
}));

describe("GET /api/admin/campaigns/x/insights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { GET } = await import("@/app/api/admin/campaigns/x/insights/route");
    const res = await GET(req("http://localhost/api/admin/campaigns/x/insights"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when X not configured", async () => {
    adminOk();
    mockIsXConfigured.mockResolvedValue(false);
    const { GET } = await import("@/app/api/admin/campaigns/x/insights/route");
    const res = await GET(req("http://localhost/api/admin/campaigns/x/insights"));
    expect(res.status).toBe(503);
  });

  it("returns stats when configured", async () => {
    adminOk();
    mockIsXConfigured.mockResolvedValue(true);
    mockGetXStats.mockResolvedValue({ impressions: 5000, engagements: 200 });
    const { GET } = await import("@/app/api/admin/campaigns/x/insights/route");
    const res = await GET(req("http://localhost/api/admin/campaigns/x/insights"));
    expect(res.status).toBe(200);
  });
});

// ── /api/admin/email/campaigns/[id] ──────────────────────────────────────────

const mockIsActiveCampaignConfigured = vi.fn();
const mockGetCampaign = vi.fn();
vi.mock("@/lib/activecampaign", async (orig) => ({
  ...(await orig<typeof import("@/lib/activecampaign")>()),
  isActiveCampaignConfigured: (...a: unknown[]) => mockIsActiveCampaignConfigured(...a),
  getCampaign: (...a: unknown[]) => mockGetCampaign(...a),
}));

describe("GET /api/admin/email/campaigns/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { GET } = await import("@/app/api/admin/email/campaigns/[id]/route");
    const res = await GET(req("http://localhost/api/admin/email/campaigns/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 503 when AC not configured", async () => {
    adminOk();
    mockIsActiveCampaignConfigured.mockResolvedValue(false);
    const { GET } = await import("@/app/api/admin/email/campaigns/[id]/route");
    const res = await GET(req("http://localhost/api/admin/email/campaigns/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(503);
  });

  it("returns 404 when campaign not found", async () => {
    adminOk();
    mockIsActiveCampaignConfigured.mockResolvedValue(true);
    mockGetCampaign.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/email/campaigns/[id]/route");
    const res = await GET(req("http://localhost/api/admin/email/campaigns/999"), {
      params: Promise.resolve({ id: "999" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns campaign when found", async () => {
    adminOk();
    mockIsActiveCampaignConfigured.mockResolvedValue(true);
    mockGetCampaign.mockResolvedValue({ id: "1", name: "Newsletter", status: "sent" });
    const { GET } = await import("@/app/api/admin/email/campaigns/[id]/route");
    const res = await GET(req("http://localhost/api/admin/email/campaigns/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.campaign.name).toBe("Newsletter");
  });
});
