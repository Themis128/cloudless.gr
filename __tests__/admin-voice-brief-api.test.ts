import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockGetConfig, mockSSMSend, mockFetch } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockSSMSend: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT");
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));
vi.stubGlobal("fetch", mockFetch);

vi.mock("@aws-sdk/client-ssm", async () => {
  const actual = await vi.importActual<typeof import("@aws-sdk/client-ssm")>("@aws-sdk/client-ssm");
  return {
    ...actual,
    SSMClient: vi.fn().mockImplementation(function() { return { send: mockSSMSend }; }),
  };
});

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
function makeAdminToken(): string {
  const payload = {
    sub: "admin-sub",
    "cognito:groups": ["admin"],
    token_use: "id",
    aud: "client",
    iss: "https://cognito-idp.us-east-1.amazonaws.com/pool",
    iat: Math.floor(Date.now() / 1000) - 10,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const h = Buffer.from("{}").toString("base64url");
  const b = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${h}.${b}.sig`;
}

function makeUserToken(): string {
  const payload = {
    sub: "user-sub",
    "cognito:groups": [],
    token_use: "id",
    aud: "client",
    iss: "https://cognito-idp.us-east-1.amazonaws.com/pool",
    iat: Math.floor(Date.now() / 1000) - 10,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const h = Buffer.from("{}").toString("base64url");
  const b = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${h}.${b}.sig`;
}

function adminReq(url: string, init?: { method?: string; body?: string }): NextRequest {
  const headers = new Headers({ Authorization: `Bearer ${makeAdminToken()}` });
  if (init?.body) headers.set("Content-Type", "application/json");
  return new NextRequest(url, { method: init?.method, body: init?.body, headers });
}

function userReq(url: string): NextRequest {
  return new NextRequest(url, { headers: { Authorization: `Bearer ${makeUserToken()}` } });
}

const MOCK_BRIEF = {
  text: "Weekly brief for Cloudless.gr.",
  generatedAt: new Date().toISOString(),
  week: "2026-W17",
};

const BASE_CFG = { AWS_REGION: "eu-central-1", CRON_SECRET: "test-cron-secret" };

// ---------------------------------------------------------------------------
// Tests — GET (admin reads latest brief from SSM)
// ---------------------------------------------------------------------------
describe("GET /api/admin/voice-brief", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue(BASE_CFG);
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify(MOCK_BRIEF) } });
  });

  it("returns 401 without token", async () => {
    const { GET } = await import("@/app/api/admin/voice-brief/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/voice-brief"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    const { GET } = await import("@/app/api/admin/voice-brief/route");
    const res = await GET(userReq("http://localhost/api/admin/voice-brief"));
    expect(res.status).toBe(403);
  });

  it("returns brief from SSM when present", async () => {
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify(MOCK_BRIEF) } });
    const { GET } = await import("@/app/api/admin/voice-brief/route");
    const res = await GET(adminReq("http://localhost/api/admin/voice-brief"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.brief).toMatchObject({ text: MOCK_BRIEF.text, week: MOCK_BRIEF.week });
  });

  it("returns null brief when SSM parameter missing", async () => {
    mockSSMSend.mockRejectedValue(new Error("ParameterNotFound"));
    const { GET } = await import("@/app/api/admin/voice-brief/route");
    const res = await GET(adminReq("http://localhost/api/admin/voice-brief"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.brief).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — POST (admin triggers on-demand generation)
// ---------------------------------------------------------------------------
describe("POST /api/admin/voice-brief", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue({ ...BASE_CFG, NEXTAUTH_URL: "http://localhost" });
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.NEXTAUTH_URL = "http://localhost";
  });

  it("returns 401 without token", async () => {
    const { POST } = await import("@/app/api/admin/voice-brief/route");
    const res = await POST(new NextRequest("http://localhost/api/admin/voice-brief", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("returns brief when cron route succeeds", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "AI-enhanced brief.", generatedAt: new Date().toISOString() }),
    });
    const { POST } = await import("@/app/api/admin/voice-brief/route");
    const res = await POST(adminReq("http://localhost/api/admin/voice-brief", { method: "POST" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.brief).toBeDefined();
    expect(data.brief.text).toBe("AI-enhanced brief.");
    expect(data.brief.week).toBe("on-demand");
  });

  it("returns 500 when cron route fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const { POST } = await import("@/app/api/admin/voice-brief/route");
    const res = await POST(adminReq("http://localhost/api/admin/voice-brief", { method: "POST" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});
