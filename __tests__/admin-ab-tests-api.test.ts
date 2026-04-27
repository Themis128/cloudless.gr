import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_FLAGS } from "@/lib/ab-flags";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockSSMSend } = vi.hoisted(() => ({
  mockSSMSend: vi.fn(),
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

vi.mock("@aws-sdk/client-ssm", async () => {
  const actual = await vi.importActual<typeof import("@aws-sdk/client-ssm")>("@aws-sdk/client-ssm");
  return {
    ...actual,
    SSMClient: vi.fn().mockImplementation(() => ({ send: mockSSMSend })),
  };
});

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
function makeAdminToken(): string {
  const payload = {
    sub: "admin-sub",
    "cognito:groups": ["admin"],
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GET /api/admin/ab-tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify(DEFAULT_FLAGS) } });
  });

  it("returns 401 without token", async () => {
    const { GET } = await import("@/app/api/admin/ab-tests/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/ab-tests"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    const { GET } = await import("@/app/api/admin/ab-tests/route");
    const res = await GET(userReq("http://localhost/api/admin/ab-tests"));
    expect(res.status).toBe(403);
  });

  it("returns flags array for admin", async () => {
    const { GET } = await import("@/app/api/admin/ab-tests/route");
    const res = await GET(adminReq("http://localhost/api/admin/ab-tests"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.flags)).toBe(true);
    expect(data.flags.length).toBeGreaterThan(0);
    expect(data.flags[0]).toHaveProperty("id");
    expect(data.flags[0]).toHaveProperty("enabled");
    expect(data.flags[0]).toHaveProperty("trafficSplit");
  });

  it("falls back to DEFAULT_FLAGS when SSM throws", async () => {
    mockSSMSend.mockRejectedValue(new Error("SSM unavailable"));
    const { GET } = await import("@/app/api/admin/ab-tests/route");
    const res = await GET(adminReq("http://localhost/api/admin/ab-tests"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.flags).toEqual(DEFAULT_FLAGS);
  });
});

describe("PATCH /api/admin/ab-tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSSMSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify(DEFAULT_FLAGS) } }) // getABFlags read
      .mockResolvedValue({}); // putSSMParam write
  });

  it("returns 400 when id is missing", async () => {
    const { PATCH } = await import("@/app/api/admin/ab-tests/route");
    const res = await PATCH(adminReq("http://localhost/api/admin/ab-tests", {
      method: "PATCH",
      body: JSON.stringify({ enabled: true }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when flag id is unknown", async () => {
    const { PATCH } = await import("@/app/api/admin/ab-tests/route");
    const res = await PATCH(adminReq("http://localhost/api/admin/ab-tests", {
      method: "PATCH",
      body: JSON.stringify({ id: "does-not-exist", enabled: true }),
    }));
    expect(res.status).toBe(404);
  });

  it("updates a flag and returns updated flags", async () => {
    const { PATCH } = await import("@/app/api/admin/ab-tests/route");
    const res = await PATCH(adminReq("http://localhost/api/admin/ab-tests", {
      method: "PATCH",
      body: JSON.stringify({ id: "hero-cta", enabled: true, trafficSplit: 60 }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.flags)).toBe(true);
    const updated = data.flags.find((f: { id: string }) => f.id === "hero-cta");
    expect(updated.enabled).toBe(true);
    expect(updated.trafficSplit).toBe(60);
  });
});

describe("POST /api/admin/ab-tests (reset)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSSMSend.mockResolvedValue({});
  });

  it("resets to default flags", async () => {
    const { POST } = await import("@/app/api/admin/ab-tests/route");
    const res = await POST(adminReq("http://localhost/api/admin/ab-tests", {
      method: "POST",
      body: JSON.stringify({ action: "reset" }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.flags).toEqual(DEFAULT_FLAGS);
  });

  it("returns 400 for unknown action", async () => {
    const { POST } = await import("@/app/api/admin/ab-tests/route");
    const res = await POST(adminReq("http://localhost/api/admin/ab-tests", {
      method: "POST",
      body: JSON.stringify({ action: "invalid" }),
    }));
    expect(res.status).toBe(400);
  });
});
