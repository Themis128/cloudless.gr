import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { buildTikTokAuthUrl } from "@/app/api/admin/oauth/tiktok/route";

// ── Mocks ────────────────────────────────────────────────────────────────────

const { requireAdminMock, getConfigMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  getConfigMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: getConfigMock }));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const baseConfig = {
  TIKTOK_APP_ID: "test_app_id",
  TIKTOK_APP_SECRET: "test_app_secret",
  TIKTOK_ACCESS_TOKEN: "",
  TIKTOK_ADVERTISER_ID: "",
};

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

// ── buildTikTokAuthUrl ────────────────────────────────────────────────────────

describe("buildTikTokAuthUrl", () => {
  it("includes app_id, redirect_uri and state in the URL", () => {
    const url = buildTikTokAuthUrl(
      "myapp",
      "https://example.com/callback",
      "state123",
    );
    expect(url).toContain("app_id=myapp");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("state=state123");
  });

  it("points to TikTok business portal auth endpoint", () => {
    const url = buildTikTokAuthUrl("appid", "https://x.com/cb", "s");
    expect(url).toContain("business-api.tiktok.com/portal/auth");
  });
});

// ── GET /api/admin/oauth/tiktok ───────────────────────────────────────────────

describe("GET /api/admin/oauth/tiktok", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockReturnValue({ ok: true, user: { sub: "admin" } });
    getConfigMock.mockResolvedValue({ ...baseConfig });
    process.env.CRON_SECRET = "test-cron-secret-for-hmac-signing-32chars!!";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4000";
  });

  it("returns 401 for unauthenticated requests", async () => {
    requireAdminMock.mockReturnValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });
    const { GET } = await import("@/app/api/admin/oauth/tiktok/route");
    const res = await GET(
      makeRequest("http://localhost:4000/api/admin/oauth/tiktok"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 503 when TikTok app credentials are missing", async () => {
    getConfigMock.mockResolvedValueOnce({
      TIKTOK_APP_ID: "",
      TIKTOK_APP_SECRET: "",
    });
    const { GET } = await import("@/app/api/admin/oauth/tiktok/route");
    const res = await GET(
      makeRequest("http://localhost:4000/api/admin/oauth/tiktok"),
    );
    expect(res.status).toBe(503);
  });

  it("redirects to TikTok auth URL when app is configured", async () => {
    const { GET } = await import("@/app/api/admin/oauth/tiktok/route");
    const res = await GET(
      makeRequest("http://localhost:4000/api/admin/oauth/tiktok"),
    );
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("business-api.tiktok.com/portal/auth");
    expect(location).toContain("app_id=test_app_id");
    expect(location).toContain("state=");
  });
});

// ── GET /api/admin/oauth/tiktok/callback ─────────────────────────────────────

describe("GET /api/admin/oauth/tiktok/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockReturnValue({ ok: true, user: { sub: "admin" } });
    getConfigMock.mockResolvedValue({ ...baseConfig });
    process.env.CRON_SECRET = "test-cron-secret-for-hmac-signing-32chars!!";
  });

  function makeCallbackRequest(qs: Record<string, string>): NextRequest {
    const params = new URLSearchParams(qs);
    return makeRequest(
      `http://localhost:4000/api/admin/oauth/tiktok/callback?${params.toString()}`,
    );
  }

  it("returns 401 for unauthenticated requests", async () => {
    requireAdminMock.mockReturnValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });
    const { GET } = await import("@/app/api/admin/oauth/tiktok/callback/route");
    const res = await GET(
      makeCallbackRequest({ auth_code: "code", state: "bad" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 HTML when error param is present", async () => {
    const { GET } = await import("@/app/api/admin/oauth/tiktok/callback/route");
    const res = await GET(
      makeCallbackRequest({ error: "access_denied", state: "s" }),
    );
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("access_denied");
  });

  it("returns 400 HTML when auth_code is missing", async () => {
    const { GET } = await import("@/app/api/admin/oauth/tiktok/callback/route");
    const res = await GET(makeCallbackRequest({ state: "s" }));
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("Missing auth_code");
  });

  it("returns 400 HTML when state is invalid (CSRF guard)", async () => {
    const { GET } = await import("@/app/api/admin/oauth/tiktok/callback/route");
    const res = await GET(
      makeCallbackRequest({ auth_code: "code", state: "bad-state.badsig" }),
    );
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("Invalid state");
  });

  it("returns 200 HTML with token and advertiser IDs on success", async () => {
    // Generate a valid state by importing the initiation route's helper
    const { createHmac } = await import("crypto");
    const secret = process.env.CRON_SECRET!;
    const nonce = "test-nonce-123";
    const sig = createHmac("sha256", secret)
      .update(nonce)
      .digest("hex")
      .slice(0, 16);
    const state = `${nonce}.${sig}`;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 0,
        message: "OK",
        data: {
          access_token: "tiktok_access_token_abc",
          advertiser_ids: ["123456789"],
          token_type: "bearer",
          scope: ["advertiser_management"],
        },
      }),
    });

    const { GET } = await import("@/app/api/admin/oauth/tiktok/callback/route");
    const res = await GET(
      makeCallbackRequest({ auth_code: "valid_code", state }),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("tiktok_access_token_abc");
    expect(body).toContain("123456789");
    expect(body).toContain("TIKTOK_ACCESS_TOKEN");
  });

  it("returns 502 HTML when TikTok token exchange fails", async () => {
    const { createHmac } = await import("crypto");
    const secret = process.env.CRON_SECRET!;
    const nonce = "test-nonce-456";
    const sig = createHmac("sha256", secret)
      .update(nonce)
      .digest("hex")
      .slice(0, 16);
    const state = `${nonce}.${sig}`;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 40001, message: "Invalid auth_code" }),
    });

    const { GET } = await import("@/app/api/admin/oauth/tiktok/callback/route");
    const res = await GET(
      makeCallbackRequest({ auth_code: "bad_code", state }),
    );
    expect(res.status).toBe(502);
    const body = await res.text();
    expect(body).toContain("Invalid auth_code");
  });
});

// ── verifyActiveCampaignToken ─────────────────────────────────────────────────

describe("verifyActiveCampaignToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    fetchMock.mockReset();
  });

  it("returns not_configured when URL and token are missing", async () => {
    vi.doMock("@/lib/ssm-config", () => ({
      getConfig: vi
        .fn()
        .mockResolvedValue({
          ACTIVECAMPAIGN_API_URL: "",
          ACTIVECAMPAIGN_API_TOKEN: "",
        }),
    }));
    const { verifyActiveCampaignToken } = await import("@/lib/activecampaign");
    const result = await verifyActiveCampaignToken();
    expect(result.status).toBe("not_configured");
  });

  it("returns valid when API returns 200", async () => {
    vi.doMock("@/lib/ssm-config", () => ({
      getConfig: vi.fn().mockResolvedValue({
        ACTIVECAMPAIGN_API_URL: "https://account.api-us1.com",
        ACTIVECAMPAIGN_API_TOKEN: "token123",
      }),
    }));
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    const { verifyActiveCampaignToken } = await import("@/lib/activecampaign");
    const result = await verifyActiveCampaignToken();
    expect(result.status).toBe("valid");
  });

  it("returns rejected when API returns 401", async () => {
    vi.doMock("@/lib/ssm-config", () => ({
      getConfig: vi.fn().mockResolvedValue({
        ACTIVECAMPAIGN_API_URL: "https://account.api-us1.com",
        ACTIVECAMPAIGN_API_TOKEN: "expired-token",
      }),
    }));
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    const { verifyActiveCampaignToken } = await import("@/lib/activecampaign");
    const result = await verifyActiveCampaignToken();
    expect(result.status).toBe("rejected");
    expect(result.message).toContain("401");
  });

  it("returns error when fetch throws", async () => {
    vi.doMock("@/lib/ssm-config", () => ({
      getConfig: vi.fn().mockResolvedValue({
        ACTIVECAMPAIGN_API_URL: "https://account.api-us1.com",
        ACTIVECAMPAIGN_API_TOKEN: "token123",
      }),
    }));
    fetchMock.mockRejectedValueOnce(new Error("network error"));
    const { verifyActiveCampaignToken } = await import("@/lib/activecampaign");
    const result = await verifyActiveCampaignToken();
    expect(result.status).toBe("error");
    expect(result.message).toContain("Connection failed");
  });
});
