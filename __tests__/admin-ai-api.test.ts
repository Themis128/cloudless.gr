import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { getConfigMock } = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
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

// Mock fetch globally — routes call Anthropic via fetch
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

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

function adminReq(url: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${makeAdminToken()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function unauthReq(url: string): NextRequest {
  return new NextRequest(url, { method: "POST", body: JSON.stringify({ brief: "test" }) });
}

function mockAnthropicResponse(text: string) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ content: [{ text }] }),
  });
}

// ---------------------------------------------------------------------------
// POST /api/admin/ai/campaign
// ---------------------------------------------------------------------------
describe("POST /api/admin/ai/campaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfigMock.mockResolvedValue({ ANTHROPIC_API_KEY: "test-anthropic-key" });
  });

  it("returns 401 when not authenticated", async () => {
    const { POST } = await import("@/app/api/admin/ai/campaign/route");
    const res = await POST(unauthReq("http://localhost/api/admin/ai/campaign"));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when brief is missing", async () => {
    const { POST } = await import("@/app/api/admin/ai/campaign/route");
    const req = new NextRequest("http://localhost/api/admin/ai/campaign", {
      method: "POST",
      headers: { Authorization: `Bearer ${makeAdminToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ budget: "€500" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 503 when ANTHROPIC_API_KEY not configured", async () => {
    getConfigMock.mockResolvedValue({});
    const saved = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "";
    const { POST } = await import("@/app/api/admin/ai/campaign/route");
    const res = await POST(adminReq("http://localhost/api/admin/ai/campaign", { brief: "Promote AI tool" }));
    process.env.ANTHROPIC_API_KEY = saved;
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns campaign strategy from Claude", async () => {
    const strategy = { recommended_platforms: ["Meta", "LinkedIn"], campaign_objective: "LEAD_GENERATION" };
    mockAnthropicResponse(JSON.stringify(strategy));
    const { POST } = await import("@/app/api/admin/ai/campaign/route");
    const res = await POST(adminReq("http://localhost/api/admin/ai/campaign", {
      brief: "Promote AI marketing tool to Greek SMBs",
      budget: "€500/month",
      targetAudience: "Greek small business owners",
    }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.strategy).toBeDefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns raw text when Claude response is not valid JSON", async () => {
    mockAnthropicResponse("I recommend Meta and LinkedIn for this campaign.");
    const { POST } = await import("@/app/api/admin/ai/campaign/route");
    const res = await POST(adminReq("http://localhost/api/admin/ai/campaign", { brief: "Test" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.strategy).toHaveProperty("raw");
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/ai/copy
// ---------------------------------------------------------------------------
describe("POST /api/admin/ai/copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfigMock.mockResolvedValue({ ANTHROPIC_API_KEY: "test-anthropic-key" });
  });

  it("returns 401 when not authenticated", async () => {
    const { POST } = await import("@/app/api/admin/ai/copy/route");
    const res = await POST(unauthReq("http://localhost/api/admin/ai/copy"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when service is missing", async () => {
    const { POST } = await import("@/app/api/admin/ai/copy/route");
    const req = new NextRequest("http://localhost/api/admin/ai/copy", {
      method: "POST",
      headers: { Authorization: `Bearer ${makeAdminToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "Meta" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 503 when ANTHROPIC_API_KEY not configured", async () => {
    getConfigMock.mockResolvedValue({});
    const saved = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "";
    const { POST } = await import("@/app/api/admin/ai/copy/route");
    const res = await POST(adminReq("http://localhost/api/admin/ai/copy", { service: "AI Marketing" }));
    process.env.ANTHROPIC_API_KEY = saved;
    expect(res.status).toBe(503);
  });

  it("returns ad copy variants", async () => {
    const variants = { variants: [{ headline: "Grow Faster", body: "AI tools for your business", cta: "Get Started", tone: "professional" }] };
    mockAnthropicResponse(JSON.stringify(variants));
    const { POST } = await import("@/app/api/admin/ai/copy/route");
    const res = await POST(adminReq("http://localhost/api/admin/ai/copy", {
      service: "AI Marketing Platform",
      platform: "Meta",
      objective: "leads",
    }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.variants).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/ai/audience
// ---------------------------------------------------------------------------
describe("POST /api/admin/ai/audience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfigMock.mockResolvedValue({ ANTHROPIC_API_KEY: "test-anthropic-key" });
  });

  it("returns 401 when not authenticated", async () => {
    const { POST } = await import("@/app/api/admin/ai/audience/route");
    const res = await POST(unauthReq("http://localhost/api/admin/ai/audience"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when description is missing", async () => {
    const { POST } = await import("@/app/api/admin/ai/audience/route");
    const req = new NextRequest("http://localhost/api/admin/ai/audience", {
      method: "POST",
      headers: { Authorization: `Bearer ${makeAdminToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ platforms: ["Meta"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 503 when ANTHROPIC_API_KEY not configured", async () => {
    getConfigMock.mockResolvedValue({});
    const saved = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "";
    const { POST } = await import("@/app/api/admin/ai/audience/route");
    const res = await POST(adminReq("http://localhost/api/admin/ai/audience", { description: "Greek SMB owners" }));
    process.env.ANTHROPIC_API_KEY = saved;
    expect(res.status).toBe(503);
  });

  it("returns targeting parameters", async () => {
    const targeting = { summary: "SMB decision makers in Greece", demographics: { age_range: "30-50" } };
    mockAnthropicResponse(JSON.stringify(targeting));
    const { POST } = await import("@/app/api/admin/ai/audience/route");
    const res = await POST(adminReq("http://localhost/api/admin/ai/audience", {
      description: "Greek small business owners interested in digital marketing",
      platforms: ["Meta", "LinkedIn"],
      objective: "LEAD_GENERATION",
    }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.targeting).toBeDefined();
  });
});
