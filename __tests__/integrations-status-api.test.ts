import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

const requireAdminMock = vi.fn();
const getConfigMock = vi.fn();
const verifyACTokenMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: getConfigMock }));
vi.mock("@/lib/activecampaign", () => ({
  verifyActiveCampaignToken: verifyACTokenMock,
}));

// fetch is used for live pings (HubSpot, Slack, Notion, Stripe)
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function makeRequest(path = "/api/admin/integrations/status"): NextRequest {
  return new NextRequest(`http://localhost:4000${path}`, { method: "GET" });
}

const baseConfig = {
  SES_FROM_EMAIL: "noreply@cloudless.gr",
  AWS_SES_REGION: "us-east-1",
  COGNITO_USER_POOL_ID: "us-east-1_abc",
  COGNITO_CLIENT_ID: "client123",
  STRIPE_SECRET_KEY: "sk_test_abc",
  HUBSPOT_API_KEY: "pat-eu1-abc",
  SLACK_BOT_TOKEN: "xoxb-abc",
  NOTION_API_KEY: "secret_abc",
  GOOGLE_CLIENT_EMAIL: "sa@project.iam.gserviceaccount.com",
  GOOGLE_PRIVATE_KEY:
    "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
  GOOGLE_CALENDAR_ID: "primary",
  SENTRY_AUTH_TOKEN: "sntrys_abc",
  ANTHROPIC_API_KEY: "sk-ant-abc",
  ACTIVECAMPAIGN_API_URL: "https://account.api-us1.com",
  ACTIVECAMPAIGN_API_TOKEN: "token123",
  META_AD_ACCOUNT_ID: "act_123",
  META_ACCESS_TOKEN: "EAA...",
  META_PIXEL_ID: "449603",
  LINKEDIN_ACCESS_TOKEN: "AQWT...",
  LINKEDIN_AD_ACCOUNT_ID: "512642510",
  LINKEDIN_ORGANIZATION_URN: "urn:li:organization:108614163",
  TIKTOK_APP_ID: "appid",
  TIKTOK_APP_SECRET: "appsecret",
  TIKTOK_ACCESS_TOKEN: "",
  TIKTOK_ADVERTISER_ID: "",
  X_API_KEY: "key",
  X_API_SECRET: "secret",
  X_ACCESS_TOKEN: "token",
  X_ACCESS_SECRET: "tokensecret",
  X_AD_ACCOUNT_ID: "",
  GOOGLE_ADS_DEVELOPER_TOKEN: "",
  GOOGLE_ADS_CUSTOMER_ID: "",
};

describe("GET /api/admin/integrations/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockReturnValue({ ok: true, user: { sub: "admin" } });
    getConfigMock.mockResolvedValue({ ...baseConfig });
    verifyACTokenMock.mockResolvedValue({ status: "valid" });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, team: "Cloudless" }),
    });
  });

  it("returns 401 for unauthenticated requests", async () => {
    requireAdminMock.mockReturnValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });
    const { GET } = await import("@/app/api/admin/integrations/status/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 200 with integrations array and summary", async () => {
    const { GET } = await import("@/app/api/admin/integrations/status/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.integrations)).toBe(true);
    expect(data.summary).toBeDefined();
    expect(typeof data.summary.total).toBe("number");
    expect(data.checkedAt).toBeTruthy();
  });

  it("every integration report has required fields", async () => {
    const { GET } = await import("@/app/api/admin/integrations/status/route");
    const res = await GET(makeRequest());
    const data = await res.json();
    for (const integration of data.integrations) {
      expect(integration.id).toBeTruthy();
      expect(integration.name).toBeTruthy();
      expect(integration.category).toBeTruthy();
      expect(["configured", "not_configured", "degraded", "error"]).toContain(
        integration.status,
      );
    }
  });

  it("reports TikTok as degraded when app credentials set but access token missing", async () => {
    const { GET } = await import("@/app/api/admin/integrations/status/route");
    const res = await GET(makeRequest());
    const data = await res.json();
    const tiktok = data.integrations.find(
      (i: { id: string }) => i.id === "tiktok",
    );
    expect(tiktok.status).toBe("degraded");
    expect(tiktok.message).toContain("OAuth");
  });

  it("reports TikTok as configured when both access_token and advertiser_id are set", async () => {
    getConfigMock.mockResolvedValueOnce({
      ...baseConfig,
      TIKTOK_ACCESS_TOKEN: "tok123",
      TIKTOK_ADVERTISER_ID: "adv123",
    });
    const { GET } = await import("@/app/api/admin/integrations/status/route");
    const res = await GET(makeRequest());
    const data = await res.json();
    const tiktok = data.integrations.find(
      (i: { id: string }) => i.id === "tiktok",
    );
    expect(tiktok.status).toBe("configured");
  });

  it("reports X as degraded when tokens set but ad account ID missing", async () => {
    const { GET } = await import("@/app/api/admin/integrations/status/route");
    const res = await GET(makeRequest());
    const data = await res.json();
    const x = data.integrations.find((i: { id: string }) => i.id === "x");
    expect(x.status).toBe("degraded");
    expect(x.message).toContain("X_AD_ACCOUNT_ID");
  });

  it("reports Google Ads as not_configured when dev token missing", async () => {
    const { GET } = await import("@/app/api/admin/integrations/status/route");
    const res = await GET(makeRequest());
    const data = await res.json();
    const gads = data.integrations.find(
      (i: { id: string }) => i.id === "google_ads",
    );
    expect(gads.status).toBe("not_configured");
  });

  it("reports ActiveCampaign as degraded when token is rejected", async () => {
    verifyACTokenMock.mockResolvedValueOnce({
      status: "rejected",
      message: "Token rejected (401) — account may be expired.",
    });
    const { GET } = await import("@/app/api/admin/integrations/status/route");
    const res = await GET(makeRequest());
    const data = await res.json();
    const ac = data.integrations.find(
      (i: { id: string }) => i.id === "activecampaign",
    );
    expect(ac.status).toBe("degraded");
    expect(ac.message).toContain("expired");
  });

  it("reports Sentry as degraded when DSN set but auth token missing", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://abc@sentry.io/123";
    getConfigMock.mockResolvedValueOnce({
      ...baseConfig,
      SENTRY_AUTH_TOKEN: "",
    });
    const { GET } = await import("@/app/api/admin/integrations/status/route");
    const res = await GET(makeRequest());
    const data = await res.json();
    const sentry = data.integrations.find(
      (i: { id: string }) => i.id === "sentry",
    );
    expect(sentry.status).toBe("degraded");
    expect(sentry.message).toContain("source map");
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  it("summary counts match integrations statuses", async () => {
    const { GET } = await import("@/app/api/admin/integrations/status/route");
    const res = await GET(makeRequest());
    const data = await res.json();
    const { summary, integrations } = data;
    expect(
      summary.configured +
        summary.degraded +
        summary.not_configured +
        summary.error,
    ).toBe(summary.total);
    expect(summary.total).toBe(integrations.length);
  });
});
