import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const VOICE_BRIEF_URL = "http://localhost/api/admin/voice-brief";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockGetConfig, mockSSMSend, mockFetch, mockRunAgent, mockPersist } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockSSMSend: vi.fn(),
  mockFetch: vi.fn(),
  mockRunAgent: vi.fn(),
  mockPersist: vi.fn(),
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
vi.mock("@/lib/agent-voice-brief", () => ({
  runVoiceBriefAgent: (...a: unknown[]) => mockRunAgent(...a),
}));

const mockReadVoiceBrief = vi.fn();

vi.mock("@/lib/voice-brief-store", () => ({
  VOICE_BRIEF_SSM_NAME: "/cloudless/production/VOICE_BRIEF_LATEST",
  readVoiceBrief: (...a: unknown[]) => mockReadVoiceBrief(...a),
  persistVoiceBrief: (...a: unknown[]) => mockPersist(...a),
}));

vi.stubGlobal("fetch", mockFetch);

vi.mock("@aws-sdk/client-ssm", async () => {
  const actual = await vi.importActual<typeof import("@aws-sdk/client-ssm")>("@aws-sdk/client-ssm");
  return {
    ...actual,
    SSMClient: vi.fn().mockImplementation(function () {
      return { send: mockSSMSend };
    }),
  };
});

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
function makeAdminToken(): string {
  const payload = {
    sub: "admin-sub",
    groups: ["admin"],
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
    groups: [],
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
  return new NextRequest(url, {
    method: init?.method,
    body: init?.body,
    headers,
  });
}

function userReq(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { Authorization: `Bearer ${makeUserToken()}` },
  });
}

const MOCK_BRIEF = {
  text: "Weekly brief for Cloudless.gr.",
  generatedAt: new Date().toISOString(),
  week: "2026-W17",
};

const BASE_CFG = {
  AWS_REGION: "eu-central-1",
  CRON_SECRET: "test-cron-secret",
};

// ---------------------------------------------------------------------------
// Tests — GET (admin reads latest brief from SSM)
// ---------------------------------------------------------------------------
describe("GET /api/admin/voice-brief", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue(BASE_CFG);
    mockSSMSend.mockResolvedValue({
      Parameter: { Value: JSON.stringify(MOCK_BRIEF) },
    });
    // Read from D1 returns the brief (so we don't fall through to SSM mock)
    mockReadVoiceBrief.mockResolvedValue(MOCK_BRIEF);
   });

   it("returns 401 without token", async () => {
    const { GET } = await import("@/app/api/admin/voice-brief/route");
    const res = await GET(new NextRequest(VOICE_BRIEF_URL));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    const { GET } = await import("@/app/api/admin/voice-brief/route");
    const res = await GET(userReq(VOICE_BRIEF_URL));
    expect(res.status).toBe(403);
  });

  it("returns brief from readVoiceBrief when present", async () => {
    // readVoiceBrief returns the brief (could be from D1 or SSM internally)
    mockReadVoiceBrief.mockResolvedValue(MOCK_BRIEF);
    const { GET } = await import("@/app/api/admin/voice-brief/route");
    const res = await GET(adminReq(VOICE_BRIEF_URL));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.brief).toMatchObject({
      text: MOCK_BRIEF.text,
      week: MOCK_BRIEF.week,
    });
  });

  it("returns null brief when readVoiceBrief returns null", async () => {
    // readVoiceBrief returns null (no brief available)
    mockReadVoiceBrief.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/voice-brief/route");
    const res = await GET(adminReq(VOICE_BRIEF_URL));
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
    mockGetConfig.mockResolvedValue(BASE_CFG);
    mockRunAgent.mockResolvedValue({
      text: "AI-enhanced brief.",
      sources: [],
    });
    mockPersist.mockResolvedValue(undefined);
  });

  it("returns 401 without token", async () => {
    const { POST } = await import("@/app/api/admin/voice-brief/route");
    const res = await POST(new NextRequest(VOICE_BRIEF_URL, { method: "POST" }));
    expect(res.status).toBe(401);
    expect(mockRunAgent).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admin", async () => {
    const { POST } = await import("@/app/api/admin/voice-brief/route");
    const res = await POST(
      new NextRequest(VOICE_BRIEF_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${makeUserToken()}` },
      })
    );
    expect(res.status).toBe(403);
  });

  it("calls the agent directly and returns the generated brief", async () => {
    const { POST } = await import("@/app/api/admin/voice-brief/route");
    const res = await POST(adminReq(VOICE_BRIEF_URL, { method: "POST" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.brief.text).toBe("AI-enhanced brief.");
    expect(data.brief.week).toBe("on-demand");
    expect(typeof data.brief.generatedAt).toBe("string");
    expect(mockRunAgent).toHaveBeenCalledTimes(1);
    expect(mockPersist).toHaveBeenCalledTimes(1);
  });

  it("returns the brief even when persist fails (best-effort)", async () => {
    mockPersist.mockRejectedValueOnce(new Error("ssm down"));
    const { POST } = await import("@/app/api/admin/voice-brief/route");
    const res = await POST(adminReq(VOICE_BRIEF_URL, { method: "POST" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.brief.text).toBe("AI-enhanced brief.");
  });

  it("returns 500 when the agent throws", async () => {
    mockRunAgent.mockRejectedValueOnce(new Error("agent down"));
    const { POST } = await import("@/app/api/admin/voice-brief/route");
    const res = await POST(adminReq(VOICE_BRIEF_URL, { method: "POST" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("does NOT make any outbound HTTP call (no SSRF surface)", async () => {
    mockFetch.mockClear();
    const { POST } = await import("@/app/api/admin/voice-brief/route");
    await POST(adminReq(VOICE_BRIEF_URL, { method: "POST" }));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});